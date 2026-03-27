import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGatewayApp } from "../src/app.js";

// Mock the imessage module
vi.mock("../src/imessage.js", () => ({
  sendIMessage: vi.fn(),
  isChatDbAvailable: vi.fn(() => false),
  isChatDbReadable: vi.fn(() => false),
  getChatDbPath: vi.fn(() => "/Users/test/Library/Messages/chat.db"),
  openFullDiskAccessSettings: vi.fn(() => Promise.resolve(true)),
}));

// Mock the delivery-tracker module (no real chat.db in tests)
vi.mock("../src/delivery-tracker.js", () => ({
  checkDelivery: vi.fn(() => ({ delivered: false, found: false, accessError: false, sendFailed: false })),
}));

// Get the mocked function
import { sendIMessage } from "../src/imessage.js";
const mockedSendIMessage = vi.mocked(sendIMessage);

describe("Gateway API", () => {
  let app: ReturnType<typeof createGatewayApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createGatewayApp("http://localhost:3001");

    // Mock fetch for status reporting back to API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    });
  });

  describe("GET /health", () => {
    it("should return health status with system info", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("ok");
      expect(json.timestamp).toBeDefined();
      expect(json.system).toBeDefined();
      expect(json.system.platform).toBeDefined();
      expect(json.system.chatDbAvailable).toBeDefined();
    });
  });

  describe("POST /send", () => {
    it("should send a message successfully and return ACCEPTED", async () => {
      mockedSendIMessage.mockResolvedValue({ success: true });

      const res = await app.request("/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: 1,
          phone: "+15551234567",
          body: "Hello, world!",
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.messageId).toBe(1);
      // Gateway returns ACCEPTED — the tracker determines final status
      expect(json.status).toBe("ACCEPTED");

      expect(mockedSendIMessage).toHaveBeenCalledWith(
        "+15551234567",
        "Hello, world!",
      );
    });

    it("should delegate status reporting to the delivery tracker", async () => {
      mockedSendIMessage.mockResolvedValue({ success: true });
      const mockFetch = vi.mocked(global.fetch);

      await app.request("/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: 5,
          phone: "+15551234567",
          body: "Track this",
        }),
      });

      // The delivery tracker reports status asynchronously via chat.db polling.
      // Since chat.db is mocked as unavailable, it falls back to optimistic
      // SENT → DELIVERED. Allow async work to complete.
      await new Promise((r) => setTimeout(r, 0));

      // Verify SENT was reported by the tracker (not the gateway handler)
      const sentCall = mockFetch.mock.calls.find((call) => {
        const body = JSON.parse(call[1]?.body as string);
        return body.status === "SENT";
      });
      expect(sentCall).toBeDefined();

      // Verify DELIVERED was also reported (optimistic fallback)
      const deliveredCall = mockFetch.mock.calls.find((call) => {
        const body = JSON.parse(call[1]?.body as string);
        return body.status === "DELIVERED";
      });
      expect(deliveredCall).toBeDefined();
    });

    it("should handle send failure", async () => {
      mockedSendIMessage.mockResolvedValue({
        success: false,
        error: "Messages.app not available",
      });

      const res = await app.request("/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: 2,
          phone: "+15551234567",
          body: "This will fail",
        }),
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Messages.app not available");
    });

    it("should report FAILED status back to API on failure", async () => {
      mockedSendIMessage.mockResolvedValue({
        success: false,
        error: "osascript timeout",
      });
      const mockFetch = vi.mocked(global.fetch);

      await app.request("/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: 6,
          phone: "+15551234567",
          body: "Will fail",
        }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/messages/6",
        expect.objectContaining({
          method: "PATCH",
        }),
      );

      // Verify FAILED status was reported with error message
      const failedCall = mockFetch.mock.calls.find((call) => {
        const body = JSON.parse(call[1]?.body as string);
        return body.status === "FAILED";
      });
      expect(failedCall).toBeDefined();
      const failedBody = JSON.parse(failedCall![1]?.body as string);
      expect(failedBody.errorMessage).toBe("osascript timeout");
    });

    it("should reject missing fields", async () => {
      const res = await app.request("/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15551234567",
          // missing id and body
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should reject empty phone number", async () => {
      const res = await app.request("/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: 1,
          phone: "",
          body: "Hello",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should reject empty body", async () => {
      const res = await app.request("/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: 1,
          phone: "+15551234567",
          body: "",
        }),
      });

      expect(res.status).toBe(400);
    });
  });
});
