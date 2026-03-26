import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { getDatabase } from "./db/index.js";
import { MessageScheduler } from "./scheduler/index.js";

const PORT = Number(process.env.API_PORT) || 3001;

const db = getDatabase();
const app = createApp(db);

// Start the message scheduler
const scheduler = new MessageScheduler({ db });
scheduler.start();

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[API] Shutting down...");
  scheduler.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[API] Shutting down...");
  scheduler.stop();
  process.exit(0);
});

console.log(`[API] Starting on http://localhost:${PORT}`);

serve({
  fetch: app.fetch,
  port: PORT,
});
