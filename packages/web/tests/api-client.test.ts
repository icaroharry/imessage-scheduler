import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to test ApiClient directly, so we import the module fresh
// and mock fetch at the global level.

describe("ApiClient", () => {
  const originalFetch = globalThis.fetch;
  let api: typeof import("@/lib/api").api;

  beforeEach(async () => {
    // Reset module cache to get fresh instance
    vi.resetModules();
    globalThis.fetch = vi.fn();

    const module = await import("@/lib/api");
    api = module.api;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetchResponse(data: unknown, status = 200) {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    });
  }

  function mockFetchError(error: string, status = 400) {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.resolve({ error }),
    });
  }

  describe("getMessages", () => {
    it("fetches messages with default params", async () => {
      const responseData = {
        data: [],
        pagination: { total: 0, limit: 50, offset: 0 },
      };
      mockFetchResponse(responseData);

      const result = await api.getMessages();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/messages",
        expect.objectContaining({
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(result).toEqual(responseData);
    });

    it("appends query params for status, limit, offset", async () => {
      mockFetchResponse({ data: [], pagination: {} });

      await api.getMessages({ status: "QUEUED", limit: 10, offset: 5 });

      const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(calledUrl).toContain("status=QUEUED");
      expect(calledUrl).toContain("limit=10");
      expect(calledUrl).toContain("offset=5");
    });
  });

  describe("getMessage", () => {
    it("fetches a single message by id", async () => {
      const responseData = {
        data: { id: 42, phone: "+15551234567", body: "Hi" },
      };
      mockFetchResponse(responseData);

      const result = await api.getMessage(42);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/messages/42",
        expect.any(Object)
      );
      expect(result).toEqual(responseData);
    });
  });

  describe("createMessage", () => {
    it("posts a new message", async () => {
      const responseData = {
        data: { id: 1, phone: "+15551234567", body: "Hello" },
      };
      mockFetchResponse(responseData);

      const result = await api.createMessage({
        phone: "+15551234567",
        body: "Hello",
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/messages",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ phone: "+15551234567", body: "Hello" }),
        })
      );
      expect(result).toEqual(responseData);
    });
  });

  describe("deleteMessage", () => {
    it("sends DELETE request", async () => {
      mockFetchResponse({ message: "Deleted" });

      await api.deleteMessage(5);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/messages/5",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("getStats", () => {
    it("fetches stats summary", async () => {
      const stats = {
        data: { total: 10, queued: 2, accepted: 1, sent: 3, delivered: 3, failed: 1 },
      };
      mockFetchResponse(stats);

      const result = await api.getStats();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/messages/stats/summary",
        expect.any(Object)
      );
      expect(result).toEqual(stats);
    });
  });

  describe("config", () => {
    it("fetches config", async () => {
      const config = {
        data: { sendIntervalMs: 3600000, gatewayUrl: "http://localhost:3002" },
      };
      mockFetchResponse(config);

      const result = await api.getConfig();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/config",
        expect.any(Object)
      );
      expect(result).toEqual(config);
    });

    it("updates config with PATCH", async () => {
      mockFetchResponse({ data: { sendIntervalMs: 5000 } });

      await api.updateConfig({ sendIntervalMs: 5000 });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/config",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ sendIntervalMs: 5000 }),
        })
      );
    });
  });

  describe("healthCheck", () => {
    it("fetches health endpoint", async () => {
      const health = { status: "ok", timestamp: "2026-03-26T10:00:00Z" };
      mockFetchResponse(health);

      const result = await api.healthCheck();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/health",
        expect.any(Object)
      );
      expect(result).toEqual(health);
    });
  });

  describe("error handling", () => {
    it("throws with error message from response body", async () => {
      mockFetchError("Validation failed", 400);

      await expect(api.getMessages()).rejects.toThrow("Validation failed");
    });

    it("falls back to HTTP status when body has no error field", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      await expect(api.getMessages()).rejects.toThrow("HTTP 500");
    });

    it("falls back to generic message when JSON parsing fails", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error("not json")),
      });

      await expect(api.getMessages()).rejects.toThrow("Request failed");
    });
  });
});
