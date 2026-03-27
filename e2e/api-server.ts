/**
 * Custom API server entry point for e2e tests.
 *
 * Creates an in-memory SQLite database pre-configured with:
 * - Short scheduler interval (500ms) so messages are picked up quickly
 * - Mock gateway URL (http://localhost:3052) pointing to the mock gateway
 *
 * This avoids modifying the production API code.
 */
import { serve } from "@hono/node-server";
import { createApp } from "../packages/api/src/app.js";
import { createDatabase } from "../packages/api/src/db/index.js";
import { MessageScheduler } from "../packages/api/src/scheduler/index.js";
import { config } from "../packages/api/src/db/schema.js";
import { eq } from "drizzle-orm";

const PORT = Number(process.env.E2E_API_PORT) || 3051;
const GATEWAY_URL = process.env.E2E_GATEWAY_URL || "http://localhost:3052";
const SEND_INTERVAL_MS = Number(process.env.E2E_SEND_INTERVAL_MS) || 500;

// Create in-memory database
const db = createDatabase(":memory:");

// Override config for e2e testing
db.update(config)
  .set({ value: String(SEND_INTERVAL_MS) })
  .where(eq(config.key, "send_interval_ms"))
  .run();

db.update(config)
  .set({ value: GATEWAY_URL })
  .where(eq(config.key, "gateway_url"))
  .run();

const app = createApp(db);

// Start scheduler with the short interval
const scheduler = new MessageScheduler({ db });
scheduler.start();

// Graceful shutdown
process.on("SIGINT", () => {
  scheduler.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  scheduler.stop();
  process.exit(0);
});

console.log(`[E2E API] Starting on http://localhost:${PORT}`);
console.log(`[E2E API] Gateway URL: ${GATEWAY_URL}`);
console.log(`[E2E API] Scheduler interval: ${SEND_INTERVAL_MS}ms`);

serve({ fetch: app.fetch, port: PORT });
