import { serve } from "@hono/node-server";
import { createGatewayApp } from "./app.js";

const PORT = Number(process.env.GATEWAY_PORT) || 3002;
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";

const app = createGatewayApp(API_BASE_URL);

console.log(`[Gateway] Starting on http://localhost:${PORT}`);
console.log(`[Gateway] API base URL: ${API_BASE_URL}`);
console.log(`[Gateway] Platform: ${process.platform}`);

if (process.platform !== "darwin") {
  console.warn(
    "[Gateway] ⚠️  Not running on macOS — iMessage sending will not work.",
  );
  console.warn(
    "[Gateway] The gateway will still accept requests but they will fail.",
  );
}

serve({
  fetch: app.fetch,
  port: PORT,
});
