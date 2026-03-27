import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../src/db/schema.js";
import { createApp } from "../src/app.js";
import type { AppDatabase } from "../src/db/index.js";

function createTestDb(): AppDatabase {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED', 'ACCEPTED', 'SENT', 'DELIVERED', 'FAILED')),
      scheduled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at TEXT,
      delivered_at TEXT,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO config (key, value) VALUES ('send_interval_ms', '3600000');
    INSERT OR IGNORE INTO config (key, value) VALUES ('gateway_url', 'http://localhost:3002');
  `);

  return drizzle(sqlite, { schema });
}

describe("Messages API", () => {
  let app: ReturnType<typeof createApp>;
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();
    app = createApp(db);
  });

  describe("POST /messages", () => {
    it("should create a new message", async () => {
      const res = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15551234567",
          body: "Hello, world!",
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data).toMatchObject({
        phone: "+15551234567",
        body: "Hello, world!",
        status: "QUEUED",
      });
      expect(json.data.id).toBeDefined();
      expect(json.data.createdAt).toBeDefined();
    });

    it("should reject empty phone number", async () => {
      const res = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "",
          body: "Hello",
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Validation failed");
      expect(json.details.phone).toContain("Phone number is required");
    });

    it("should reject empty message body", async () => {
      const res = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15551234567",
          body: "",
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Validation failed");
      expect(json.details.body).toContain("Message body is required");
    });

    it("should reject invalid phone number format", async () => {
      const res = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "not-a-phone",
          body: "Hello",
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Validation failed");
      expect(json.details.phone).toContain("Invalid phone number format");
    });

    it("should accept phone numbers with various formats", async () => {
      const validPhones = [
        "+15551234567",
        "555-123-4567",
        "(555) 123-4567",
        "+1 (555) 123-4567",
      ];

      for (const phone of validPhones) {
        const res = await app.request("/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, body: "Test" }),
        });
        expect(res.status).toBe(201);
      }
    });

    it("should accept a scheduled_at timestamp", async () => {
      const scheduledAt = new Date(
        Date.now() + 3600000,
      ).toISOString();

      const res = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15551234567",
          body: "Future message",
          scheduledAt,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.scheduledAt).toBe(scheduledAt);
    });

    it("should reject a message body longer than 2000 characters", async () => {
      const res = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15551234567",
          body: "A".repeat(2001),
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.details.body).toContain("Message too long");
    });

    it("should reject an invalid scheduled_at timestamp", async () => {
      const res = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15551234567",
          body: "Future message",
          scheduledAt: "tomorrow-ish",
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.details.scheduledAt).toBeDefined();
    });
  });

  describe("GET /messages", () => {
    beforeEach(async () => {
      // Seed some messages
      for (let i = 0; i < 5; i++) {
        await app.request("/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: `+1555000000${i}`,
            body: `Test message ${i}`,
          }),
        });
      }
    });

    it("should return all messages", async () => {
      const res = await app.request("/messages");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(5);
      expect(json.pagination.total).toBe(5);
    });

    it("should support limit and offset", async () => {
      const res = await app.request("/messages?limit=2&offset=1");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(2);
      expect(json.pagination.limit).toBe(2);
      expect(json.pagination.offset).toBe(1);
    });

    it("should filter by status", async () => {
      const res = await app.request("/messages?status=QUEUED");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(5);
      json.data.forEach((msg: { status: string }) => {
        expect(msg.status).toBe("QUEUED");
      });
    });

    it("should return empty for non-matching status", async () => {
      const res = await app.request("/messages?status=DELIVERED");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(0);
    });

    it("should return messages ordered by created_at descending", async () => {
      const res = await app.request("/messages");
      const json = await res.json();

      for (let i = 1; i < json.data.length; i++) {
        expect(json.data[i - 1].createdAt >= json.data[i].createdAt).toBe(
          true,
        );
      }
    });
  });

  describe("GET /messages/:id", () => {
    it("should return a specific message", async () => {
      // Create a message first
      const createRes = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15551234567",
          body: "Hello!",
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/messages/${created.data.id}`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.id).toBe(created.data.id);
      expect(json.data.phone).toBe("+15551234567");
    });

    it("should return 404 for non-existent message", async () => {
      const res = await app.request("/messages/99999");
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBe("Message not found");
    });

    it("should return 400 for invalid ID", async () => {
      const res = await app.request("/messages/abc");
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid message ID");
    });
  });

  describe("PATCH /messages/:id", () => {
    it("should update message status", async () => {
      const createRes = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15551234567",
          body: "Hello!",
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/messages/${created.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SENT" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe("SENT");
      expect(json.data.sentAt).toBeNull();
    });

    it("should update error message", async () => {
      const createRes = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15551234567",
          body: "Hello!",
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/messages/${created.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "FAILED",
          errorMessage: "Gateway timeout",
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe("FAILED");
      expect(json.data.errorMessage).toBe("Gateway timeout");
    });

    it("should update timestamps and preserve nullable fields explicitly", async () => {
      const createRes = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15551234567",
          body: "Hello!",
        }),
      });
      const created = await createRes.json();
      const sentAt = new Date("2026-03-26T12:00:00.000Z").toISOString();
      const deliveredAt = new Date("2026-03-26T12:01:00.000Z").toISOString();

      const res = await app.request(`/messages/${created.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "DELIVERED",
          sentAt,
          deliveredAt,
          errorMessage: "",
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe("DELIVERED");
      expect(json.data.sentAt).toBe(sentAt);
      expect(json.data.deliveredAt).toBe(deliveredAt);
      expect(json.data.errorMessage).toBe("");
      expect(json.data.updatedAt).not.toBe(created.data.updatedAt);
    });

    it("should allow clearing previously stored fields with null", async () => {
      const createRes = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15551234567",
          body: "Hello!",
        }),
      });
      const created = await createRes.json();
      const sentAt = new Date("2026-03-26T12:00:00.000Z").toISOString();

      await app.request(`/messages/${created.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "FAILED",
          sentAt,
          deliveredAt: sentAt,
          errorMessage: "temporary issue",
        }),
      });

      const clearRes = await app.request(`/messages/${created.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          errorMessage: null,
          sentAt: null,
          deliveredAt: null,
        }),
      });

      expect(clearRes.status).toBe(200);
      const json = await clearRes.json();
      expect(json.data.errorMessage).toBeNull();
      expect(json.data.sentAt).toBeNull();
      expect(json.data.deliveredAt).toBeNull();
      expect(json.data.status).toBe("FAILED");
    });

    it("should reject invalid patch payloads", async () => {
      const createRes = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15551234567",
          body: "Hello!",
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/messages/${created.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "NOT_A_STATUS",
          sentAt: "yesterday",
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Validation failed");
      expect(json.details.status).toBeDefined();
      expect(json.details.sentAt).toBeDefined();
    });

    it("should return 404 for non-existent message", async () => {
      const res = await app.request("/messages/99999", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SENT" }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Message not found");
    });

    it("should return 400 for invalid IDs", async () => {
      const res = await app.request("/messages/not-a-number", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SENT" }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid message ID");
    });
  });

  describe("DELETE /messages/:id", () => {
    it("should delete a queued message", async () => {
      const createRes = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15551234567",
          body: "Hello!",
        }),
      });
      const created = await createRes.json();

      const res = await app.request(`/messages/${created.data.id}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe("Message deleted");

      // Verify it's gone
      const getRes = await app.request(`/messages/${created.data.id}`);
      expect(getRes.status).toBe(404);
    });

    it("should not delete a non-QUEUED message", async () => {
      const createRes = await app.request("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15551234567",
          body: "Hello!",
        }),
      });
      const created = await createRes.json();

      // Update to SENT
      await app.request(`/messages/${created.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SENT" }),
      });

      const res = await app.request(`/messages/${created.data.id}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toBe("Can only delete messages with QUEUED status");
    });

    it("should return 404 for non-existent message", async () => {
      const res = await app.request("/messages/99999", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Message not found");
    });

    it("should return 400 for invalid IDs", async () => {
      const res = await app.request("/messages/nope", {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid message ID");
    });
  });

  describe("GET /messages/stats/summary", () => {
    it("should return correct stats", async () => {
      // Create messages with different statuses
      const createMsg = async (body: string) => {
        const res = await app.request("/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "+15551234567", body }),
        });
        return (await res.json()).data;
      };

      const msg1 = await createMsg("Message 1");
      const msg2 = await createMsg("Message 2");
      const msg3 = await createMsg("Message 3");

      // Update some statuses
      await app.request(`/messages/${msg2.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DELIVERED" }),
      });
      await app.request(`/messages/${msg3.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "FAILED" }),
      });

      const res = await app.request("/messages/stats/summary");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.total).toBe(3);
      expect(json.data.queued).toBe(1);
      expect(json.data.accepted).toBe(0);
      expect(json.data.sent).toBe(0);
      expect(json.data.delivered).toBe(1);
      expect(json.data.failed).toBe(1);
    });

    it("should return zero counts when empty", async () => {
      const res = await app.request("/messages/stats/summary");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.total).toBe(0);
      expect(json.data.queued).toBe(0);
      expect(json.data.accepted).toBe(0);
      expect(json.data.sent).toBe(0);
      expect(json.data.delivered).toBe(0);
      expect(json.data.failed).toBe(0);
    });
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("ok");
      expect(json.timestamp).toBeDefined();
    });
  });
});
