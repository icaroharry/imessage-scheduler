import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export function createDatabase(url: string = "./data/scheduler.db"): AppDatabase {
  const sqlite = new Database(url);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  // Create tables if they don't exist
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

  return db;
}

// Singleton for production use
let _db: AppDatabase | null = null;

export function getDatabase(): AppDatabase {
  if (!_db) {
    _db = createDatabase(process.env.DATABASE_URL || "./data/scheduler.db");
  }
  return _db;
}
