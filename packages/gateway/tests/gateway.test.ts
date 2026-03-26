import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGatewayApp } from "../src/app.js";

// Mock the imessage module
vi.mock("../src/imessage.js", () => ({
  sendIMessage: vi.fn(),
  isChatDbAvailable: vi.fn(() => false),
  getChatDbPath: vi.fn(() => "/Users/test/Library/Messages/chat.db"),
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
    });
  });

  describe("POST /send", () => {
    it("should send a message successfully", async () => {
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
      expect(json.status).toBe("SENT");

      expect(mockedSendIMessage).toHaveBeenCalledWith(
        "+15551234567",
        "Hello, world!",
      );
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

    it("should report delivery status back to API on success", async () => {
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

      // Should have called the API to report DELIVERED status
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/messages/5",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        }),
      );
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
