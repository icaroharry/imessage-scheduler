import { describe, it, expect, beforeEach } from "vitest";
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

describe("Config API", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = createTestDb();
    app = createApp(db);
  });

  describe("GET /config", () => {
    it("should return default configuration", async () => {
      const res = await app.request("/config");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.sendIntervalMs).toBe(3600000);
      expect(json.data.gatewayUrl).toBe("http://localhost:3002");
    });
  });

  describe("PATCH /config", () => {
    it("should update send interval", async () => {
      const res = await app.request("/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendIntervalMs: 1800000 }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.sendIntervalMs).toBe(1800000);
    });

    it("should update gateway URL", async () => {
      const res = await app.request("/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayUrl: "http://example.com:3002" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.gatewayUrl).toBe("http://example.com:3002");
    });

    it("should reject interval below 1000ms", async () => {
      const res = await app.request("/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendIntervalMs: 500 }),
      });

      expect(res.status).toBe(400);
    });

    it("should reject interval above 24 hours", async () => {
      const res = await app.request("/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendIntervalMs: 100000000 }),
      });

      expect(res.status).toBe(400);
    });

    it("should reject invalid gateway URL", async () => {
      const res = await app.request("/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayUrl: "not-a-url" }),
      });

      expect(res.status).toBe(400);
    });

    it("should persist changes", async () => {
      await app.request("/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendIntervalMs: 60000 }),
      });

      const res = await app.request("/config");
      const json = await res.json();
      expect(json.data.sendIntervalMs).toBe(60000);
    });
  });
});
