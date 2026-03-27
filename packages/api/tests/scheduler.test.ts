import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema.js";
import { MessageScheduler } from "../src/scheduler/index.js";
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

function seedMessage(
  db: AppDatabase,
  overrides: Partial<schema.NewMessage> = {},
) {
  return db
    .insert(schema.messages)
    .values({
      phone: "+15551234567",
      body: "Test message",
      status: "QUEUED",
      ...overrides,
    })
    .returning()
    .get();
}

describe("MessageScheduler", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  describe("getNextMessage", () => {
    it("should return the oldest QUEUED message", () => {
      seedMessage(db, { body: "First" });
      seedMessage(db, { body: "Second" });
      seedMessage(db, { body: "Third" });

      const scheduler = new MessageScheduler({ db });
      const next = scheduler.getNextMessage();

      expect(next).not.toBeNull();
      expect(next!.body).toBe("First");
    });

    it("should return null when no QUEUED messages", () => {
      seedMessage(db, { status: "SENT" });
      seedMessage(db, { status: "DELIVERED" });

      const scheduler = new MessageScheduler({ db });
      const next = scheduler.getNextMessage();

      expect(next).toBeNull();
    });

    it("should skip messages scheduled in the future", () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      seedMessage(db, { body: "Future", scheduledAt: future });

      const scheduler = new MessageScheduler({ db });
      const next = scheduler.getNextMessage();

      expect(next).toBeNull();
    });

    it("should return past-scheduled messages", () => {
      const past = new Date(Date.now() - 3600000).toISOString();
      seedMessage(db, { body: "Past scheduled", scheduledAt: past });

      const scheduler = new MessageScheduler({ db });
      const next = scheduler.getNextMessage();

      expect(next).not.toBeNull();
      expect(next!.body).toBe("Past scheduled");
    });

    it("should return null when queue is empty", () => {
      const scheduler = new MessageScheduler({ db });
      const next = scheduler.getNextMessage();

      expect(next).toBeNull();
    });
  });

  describe("processNext", () => {
    it("should process and leave message as ACCEPTED on success (gateway reports final status)", async () => {
      const msg = seedMessage(db, { body: "To be sent" });

      const onSend = vi.fn().mockResolvedValue(true);
      const scheduler = new MessageScheduler({ db, onSend });

      const result = await scheduler.processNext();

      expect(result).toBe(true);
      expect(onSend).toHaveBeenCalledWith({
        id: msg.id,
        phone: "+15551234567",
        body: "To be sent",
      });

      // Status stays at ACCEPTED — the gateway reports SENT/DELIVERED via PATCH
      const updated = db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, msg.id))
        .get();

      expect(updated!.status).toBe("ACCEPTED");
    });

    it("should mark message as FAILED on send error", async () => {
      const msg = seedMessage(db, { body: "Will fail" });

      const onSend = vi.fn().mockRejectedValue(new Error("Gateway down"));
      const scheduler = new MessageScheduler({ db, onSend });

      const result = await scheduler.processNext();

      expect(result).toBe(false);

      const updated = db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, msg.id))
        .get();

      expect(updated!.status).toBe("FAILED");
      expect(updated!.errorMessage).toBe("Gateway down");
    });

    it("should return false when queue is empty", async () => {
      const scheduler = new MessageScheduler({ db });
      const result = await scheduler.processNext();

      expect(result).toBe(false);
    });

    it("should process messages in FIFO order", async () => {
      seedMessage(db, { body: "First" });
      seedMessage(db, { body: "Second" });

      const sentBodies: string[] = [];
      const onSend = vi.fn().mockImplementation(async (msg) => {
        sentBodies.push(msg.body);
        return true;
      });

      const scheduler = new MessageScheduler({ db, onSend });

      await scheduler.processNext();
      await scheduler.processNext();

      expect(sentBodies).toEqual(["First", "Second"]);
    });

    it("should transition QUEUED → ACCEPTED during processing", async () => {
      const msg = seedMessage(db);
      const statuses: string[] = [];

      const onSend = vi.fn().mockImplementation(async () => {
        // At this point, the message should be ACCEPTED
        const current = db
          .select()
          .from(schema.messages)
          .where(eq(schema.messages.id, msg.id))
          .get();
        statuses.push(current!.status);
        return true;
      });

      const scheduler = new MessageScheduler({ db, onSend });
      await scheduler.processNext();

      // During send, status was ACCEPTED
      expect(statuses[0]).toBe("ACCEPTED");

      // After processNext completes, status remains ACCEPTED
      // (gateway is responsible for updating to SENT/DELIVERED)
      const final = db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, msg.id))
        .get();
      expect(final!.status).toBe("ACCEPTED");
    });

    it("should not process concurrently", async () => {
      seedMessage(db, { body: "Message 1" });
      seedMessage(db, { body: "Message 2" });

      let resolveFirst: (() => void) | undefined;
      const firstCallPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      let callCount = 0;
      const onSend = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          await firstCallPromise;
        }
        return true;
      });

      const scheduler = new MessageScheduler({ db, onSend });

      // Start two concurrent processNext calls
      const p1 = scheduler.processNext();
      const p2 = scheduler.processNext();

      // Second should return false because first is still processing
      const result2 = await p2;
      expect(result2).toBe(false);

      // Resolve first
      resolveFirst!();
      const result1 = await p1;
      expect(result1).toBe(true);
    });
  });

  describe("start/stop", () => {
    it("should start and stop without errors", () => {
      const scheduler = new MessageScheduler({ db });

      expect(() => scheduler.start()).not.toThrow();
      expect(() => scheduler.stop()).not.toThrow();
    });

    it("should warn if already running", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const scheduler = new MessageScheduler({ db });

      scheduler.start();
      scheduler.start(); // Should warn

      expect(warnSpy).toHaveBeenCalledWith("[Scheduler] Already running");

      scheduler.stop();
      warnSpy.mockRestore();
    });
  });
});
