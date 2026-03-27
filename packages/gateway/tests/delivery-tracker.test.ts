import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StatusTracker } from "../src/status-tracker.js";

// Mock imessage module
vi.mock("../src/imessage.js", () => ({
  isChatDbAvailable: vi.fn(() => true),
  isChatDbReadable: vi.fn(() => true),
  getChatDbPath: vi.fn(() => "/mock/chat.db"),
}));

// Mock delivery-tracker module
vi.mock("../src/delivery-tracker.js", () => ({
  checkDelivery: vi.fn(() => ({ delivered: false, found: false, accessError: false, sendFailed: false })),
}));

import { isChatDbAvailable } from "../src/imessage.js";
import { checkDelivery } from "../src/delivery-tracker.js";
const mockedCheckDelivery = vi.mocked(checkDelivery);
const mockedIsChatDbAvailable = vi.mocked(isChatDbAvailable);

describe("StatusTracker", () => {
  let tracker: StatusTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    tracker = new StatusTracker("http://localhost:3001");

    // Mock fetch for API status reporting
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    });
  });

  afterEach(() => {
    tracker.stopAll();
    vi.useRealTimers();
  });

  describe("reportStatus", () => {
    it("should PATCH the API with SENT status and sentAt", async () => {
      await tracker.reportStatus(1, "SENT");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/messages/1",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        }),
      );

      const body = JSON.parse(
        (vi.mocked(global.fetch).mock.calls[0][1] as any).body,
      );
      expect(body.status).toBe("SENT");
      expect(body.sentAt).toBeDefined();
      expect(body.deliveredAt).toBeUndefined();
      expect(body.errorMessage).toBeUndefined();
    });

    it("should PATCH the API with DELIVERED status and deliveredAt", async () => {
      await tracker.reportStatus(1, "DELIVERED");

      const body = JSON.parse(
        (vi.mocked(global.fetch).mock.calls[0][1] as any).body,
      );
      expect(body.status).toBe("DELIVERED");
      expect(body.deliveredAt).toBeDefined();
      expect(body.sentAt).toBeUndefined();
    });

    it("should include errorMessage for FAILED status", async () => {
      await tracker.reportStatus(1, "FAILED", "osascript crashed");

      const body = JSON.parse(
        (vi.mocked(global.fetch).mock.calls[0][1] as any).body,
      );
      expect(body.status).toBe("FAILED");
      expect(body.errorMessage).toBe("osascript crashed");
      expect(body.sentAt).toBeUndefined();
      expect(body.deliveredAt).toBeUndefined();
    });

    it("retries failed status updates with exponential backoff until success", async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "fail" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: () => Promise.resolve({ error: "still failing" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: {} }),
        } as Response);

      const pending = tracker.reportStatus(1, "FAILED", "retry me");

      await vi.advanceTimersByTimeAsync(0);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(2000);
      expect(global.fetch).toHaveBeenCalledTimes(3);

      await pending;
    });

    it("gives up after three failed attempts", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(global.fetch).mockRejectedValue(new Error("network down"));

      const pending = tracker.reportStatus(9, "SENT");

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await pending;

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("GAVE UP reporting SENT for message 9 after 3 attempts"),
      );
      errorSpy.mockRestore();
    });
  });

  describe("trackDelivery", () => {
    it("should report SENT then DELIVERED when chat.db file does not exist", async () => {
      mockedIsChatDbAvailable.mockReturnValue(false);

      tracker.trackDelivery({
        messageId: 1,
        phone: "+15551234567",
        body: "Hello",
        sentAt: new Date(),
      });

      // Allow the async reportStatus chain (SENT → DELIVERED) to resolve
      await vi.advanceTimersByTimeAsync(0);

      const calls = vi.mocked(global.fetch).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      const sentBody = JSON.parse((calls[0][1] as any).body);
      expect(sentBody.status).toBe("SENT");

      const deliveredBody = JSON.parse((calls[1][1] as any).body);
      expect(deliveredBody.status).toBe("DELIVERED");
    });

    it("should report SENT then DELIVERED when chat.db has access error", async () => {
      mockedIsChatDbAvailable.mockReturnValue(true);
      // Simulates Full Disk Access not granted
      mockedCheckDelivery.mockReturnValue({
        delivered: false,
        found: false,
        accessError: true,
        sendFailed: false,
      });

      tracker.trackDelivery({
        messageId: 1,
        phone: "+15551234567",
        body: "Hello",
        sentAt: new Date(),
      });

      await vi.advanceTimersByTimeAsync(0);

      const calls = vi.mocked(global.fetch).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      const sentBody = JSON.parse((calls[0][1] as any).body);
      expect(sentBody.status).toBe("SENT");

      const deliveredBody = JSON.parse((calls[1][1] as any).body);
      expect(deliveredBody.status).toBe("DELIVERED");

      // Should NOT start polling
      expect(mockedCheckDelivery).toHaveBeenCalledTimes(1);
    });

    it("should report SENT then DELIVERED immediately if chat.db already shows delivery", async () => {
      mockedIsChatDbAvailable.mockReturnValue(true);
      mockedCheckDelivery.mockReturnValue({
        delivered: true,
        found: true,
        accessError: false,
        sendFailed: false,
        rowid: 42,
      });

      tracker.trackDelivery({
        messageId: 1,
        phone: "+15551234567",
        body: "Hello",
        sentAt: new Date(),
      });

      await vi.advanceTimersByTimeAsync(0);

      const calls = vi.mocked(global.fetch).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      const sentBody = JSON.parse((calls[0][1] as any).body);
      expect(sentBody.status).toBe("SENT");

      const deliveredBody = JSON.parse((calls[1][1] as any).body);
      expect(deliveredBody.status).toBe("DELIVERED");
      expect(deliveredBody.deliveredAt).toBeDefined();
    });

    it("should report SENT when first found, then DELIVERED when confirmed", async () => {
      mockedIsChatDbAvailable.mockReturnValue(true);

      // First few checks: not found, then found but not delivered, then delivered
      mockedCheckDelivery
        .mockReturnValueOnce({ delivered: false, found: false, accessError: false, sendFailed: false }) // immediate check
        .mockReturnValueOnce({ delivered: false, found: true, accessError: false, sendFailed: false, rowid: 42 }) // poll 1: found
        .mockReturnValueOnce({ delivered: true, found: true, accessError: false, sendFailed: false, rowid: 42 }); // poll 2: delivered

      tracker.trackDelivery({
        messageId: 1,
        phone: "+15551234567",
        body: "Hello",
        sentAt: new Date(),
        pollIntervalMs: 1000,
        timeoutMs: 10000,
      });

      // Immediate check — not found, starts polling
      expect(mockedCheckDelivery).toHaveBeenCalledTimes(1);

      // Advance to first poll — found but not delivered → reports SENT
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockedCheckDelivery).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(0);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const sentBody = JSON.parse(
        (vi.mocked(global.fetch).mock.calls[0][1] as any).body,
      );
      expect(sentBody.status).toBe("SENT");

      // Advance to second poll — delivered → reports DELIVERED
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockedCheckDelivery).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(0);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      const deliveredBody = JSON.parse(
        (vi.mocked(global.fetch).mock.calls[1][1] as any).body,
      );
      expect(deliveredBody.status).toBe("DELIVERED");
    });

    it("should bail with SENT+DELIVERED if access error occurs during polling", async () => {
      mockedIsChatDbAvailable.mockReturnValue(true);

      mockedCheckDelivery
        .mockReturnValueOnce({ delivered: false, found: false, accessError: false, sendFailed: false }) // immediate — OK
        .mockReturnValueOnce({ delivered: false, found: false, accessError: true, sendFailed: false }); // poll 1 — access lost

      tracker.trackDelivery({
        messageId: 1,
        phone: "+15551234567",
        body: "Hello",
        sentAt: new Date(),
        pollIntervalMs: 1000,
        timeoutMs: 60000,
      });

      // Advance to first poll — access error
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(0);

      // Should have bailed and reported SENT then DELIVERED optimistically
      expect(global.fetch).toHaveBeenCalled();
      const calls = vi.mocked(global.fetch).mock.calls;
      const statuses = calls.map(
        (c) => JSON.parse((c[1] as any).body).status,
      );
      expect(statuses).toContain("SENT");
      expect(statuses).toContain("DELIVERED");

      // Should NOT poll anymore
      const callCount = mockedCheckDelivery.mock.calls.length;
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockedCheckDelivery.mock.calls.length).toBe(callCount);
    });

    it("should skip SENT and go straight to FAILED when sendFailed is detected", async () => {
      mockedIsChatDbAvailable.mockReturnValue(true);

      // Message found but sendFailed (is_sent=0 AND is_delivered=0)
      mockedCheckDelivery
        .mockReturnValueOnce({ delivered: false, found: false, accessError: false, sendFailed: false }) // immediate — not found yet
        .mockReturnValue({ delivered: false, found: true, accessError: false, sendFailed: true, rowid: 99 }); // subsequent — found, failed

      tracker.trackDelivery({
        messageId: 1,
        phone: "+15551234567",
        body: "Hello",
        sentAt: new Date(),
        pollIntervalMs: 2000,
        timeoutMs: 60000,
      });

      // First poll at 2s: found + sendFailed — should NOT report SENT (is_sent=0)
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(0);
      expect(global.fetch).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2000); // 4s elapsed
      expect(global.fetch).not.toHaveBeenCalled();

      // At 10s+, sendFailed should trigger FAILED report — no SENT before it
      await vi.advanceTimersByTimeAsync(6000); // 10s elapsed
      await vi.advanceTimersByTimeAsync(0);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(
        (vi.mocked(global.fetch).mock.calls[0][1] as any).body,
      );
      expect(body.status).toBe("FAILED");
      expect(body.errorMessage).toContain("Messages.app failed to deliver");
    });

    it("should report FAILED on timeout when sendFailed is true", async () => {
      mockedIsChatDbAvailable.mockReturnValue(true);
      // Message found with sendFailed the entire time (including immediate check)
      mockedCheckDelivery.mockReturnValue({
        delivered: false,
        found: true,
        accessError: false,
        sendFailed: true,
        rowid: 99,
      });

      tracker.trackDelivery({
        messageId: 1,
        phone: "+15551234567",
        body: "Hello",
        sentAt: new Date(),
        pollIntervalMs: 2000,
        timeoutMs: 5000,
      });

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(12000);
      await vi.advanceTimersByTimeAsync(0);

      expect(global.fetch).toHaveBeenCalled();
      // Find the final status report (skip SENT)
      const calls = vi.mocked(global.fetch).mock.calls;
      const lastBody = JSON.parse((calls[calls.length - 1][1] as any).body);
      expect(lastBody.status).toBe("FAILED");
    });

    it("should report FAILED on timeout when message is never found in chat.db", async () => {
      mockedIsChatDbAvailable.mockReturnValue(true);
      // Message never appears in chat.db
      mockedCheckDelivery.mockReturnValue({ delivered: false, found: false, accessError: false, sendFailed: false });

      tracker.trackDelivery({
        messageId: 1,
        phone: "+15551234567",
        body: "Hello",
        sentAt: new Date(),
        pollIntervalMs: 1000,
        timeoutMs: 5000,
      });

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(6000);
      await vi.advanceTimersByTimeAsync(0);

      expect(global.fetch).toHaveBeenCalled();
      const calls = vi.mocked(global.fetch).mock.calls;
      const lastBody = JSON.parse((calls[calls.length - 1][1] as any).body);
      expect(lastBody.status).toBe("FAILED");
      expect(lastBody.errorMessage).toContain("not found in Messages.app");
    });

    it("should report SENT on timeout when the message is found but still in transit", async () => {
      mockedIsChatDbAvailable.mockReturnValue(true);
      mockedCheckDelivery.mockReturnValue({
        delivered: false,
        found: true,
        accessError: false,
        sendFailed: false,
        rowid: 42,
      });

      tracker.trackDelivery({
        messageId: 1,
        phone: "+15551234567",
        body: "Hello",
        sentAt: new Date(),
        pollIntervalMs: 1000,
        timeoutMs: 3000,
      });

      await vi.advanceTimersByTimeAsync(3000);
      await vi.advanceTimersByTimeAsync(0);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(
        (vi.mocked(global.fetch).mock.calls[0][1] as any).body,
      );
      expect(body.status).toBe("SENT");
    });

    it("should stop polling after delivery is confirmed", async () => {
      mockedIsChatDbAvailable.mockReturnValue(true);
      mockedCheckDelivery
        .mockReturnValueOnce({ delivered: false, found: false, accessError: false, sendFailed: false }) // immediate
        .mockReturnValueOnce({ delivered: true, found: true, accessError: false, sendFailed: false, rowid: 42 }) // poll 1
        .mockReturnValue({ delivered: true, found: true, accessError: false, sendFailed: false, rowid: 42 }); // any further

      tracker.trackDelivery({
        messageId: 1,
        phone: "+15551234567",
        body: "Hello",
        sentAt: new Date(),
        pollIntervalMs: 1000,
        timeoutMs: 30000,
      });

      // Advance to first poll — gets delivered
      await vi.advanceTimersByTimeAsync(1000);
      const callCountAfterDelivery = mockedCheckDelivery.mock.calls.length;

      // Advance further — should NOT poll anymore
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockedCheckDelivery.mock.calls.length).toBe(callCountAfterDelivery);
    });

    it("should clean up all polls on stopAll", async () => {
      mockedIsChatDbAvailable.mockReturnValue(true);
      mockedCheckDelivery.mockReturnValue({ delivered: false, found: false, accessError: false, sendFailed: false });

      tracker.trackDelivery({
        messageId: 1,
        phone: "+15551234567",
        body: "Hello 1",
        sentAt: new Date(),
        pollIntervalMs: 1000,
        timeoutMs: 60000,
      });

      tracker.trackDelivery({
        messageId: 2,
        phone: "+15559876543",
        body: "Hello 2",
        sentAt: new Date(),
        pollIntervalMs: 1000,
        timeoutMs: 60000,
      });

      const callsBefore = mockedCheckDelivery.mock.calls.length;

      tracker.stopAll();

      // Advance — no more polls
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockedCheckDelivery.mock.calls.length).toBe(callsBefore);
    });
  });
});
