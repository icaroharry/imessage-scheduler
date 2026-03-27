import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { getDatabase } from "./db/index.js";
import { MessageScheduler } from "./scheduler/index.js";
import { emit } from "./events.js";
import { config } from "./db/schema.js";

const PORT = Number(process.env.API_PORT) || 3001;

const db = getDatabase();
const app = createApp(db);

// Start the message scheduler
const scheduler = new MessageScheduler({ db });
scheduler.start();

// ── Gateway health polling (broadcasts via SSE) ─────────────────────────
let lastGatewayStatus: "online" | "offline" | null = null;

function getGatewayUrl(): string {
  const rows = db.select().from(config).all();
  const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return cfg.gateway_url || "http://localhost:3002";
}

const gatewayHealthTimer = setInterval(async () => {
  let status: "online" | "offline";
  try {
    const res = await fetch(`${getGatewayUrl()}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    status = res.ok ? "online" : "offline";
  } catch {
    status = "offline";
  }

  // Only emit if status changed
  if (status !== lastGatewayStatus) {
    lastGatewayStatus = status;
    emit({ type: "gateway:status", data: { status } });
  }
}, 15_000);

// Check gateway immediately on start
(async () => {
  try {
    const res = await fetch(`${getGatewayUrl()}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    lastGatewayStatus = res.ok ? "online" : "offline";
  } catch {
    lastGatewayStatus = "offline";
  }
  emit({ type: "gateway:status", data: { status: lastGatewayStatus } });
})();

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[API] Shutting down...");
  scheduler.stop();
  clearInterval(gatewayHealthTimer);
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[API] Shutting down...");
  scheduler.stop();
  clearInterval(gatewayHealthTimer);
  process.exit(0);
});

console.log(`[API] Starting on http://localhost:${PORT}`);

serve({
  fetch: app.fetch,
  port: PORT,
});
