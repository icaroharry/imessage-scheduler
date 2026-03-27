/**
 * Mock iMessage gateway for e2e tests.
 *
 * Instead of actually sending messages via osascript and polling chat.db,
 * this mock:
 * 1. Receives POST /send with { id, phone, body }
 * 2. Builds a synthetic attributedBody blob from the body text
 * 3. Runs the REAL extractTextFromAttributedBody function on it
 * 4. If extraction matches → reports SENT then DELIVERED back to the API
 * 5. If extraction fails → reports FAILED
 *
 * This verifies that the extraction function works correctly for messages
 * of all sizes as part of the full delivery flow.
 */
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { extractTextFromAttributedBody } from "../packages/gateway/src/delivery-tracker.js";
import { buildAttributedBodyBlob } from "./helpers.js";

const PORT = Number(process.env.E2E_GATEWAY_PORT) || 3052;
const API_URL = process.env.E2E_API_URL || "http://localhost:3051";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ ok: true, mock: true });
});

app.post("/send", async (c) => {
  const { id, phone, body } = await c.req.json<{
    id: number;
    phone: string;
    body: string;
  }>();

  console.log(`[Mock Gateway] Received send request for message ${id} (${body.length} chars)`);

  // Build a synthetic attributedBody blob from the body text
  const blob = buildAttributedBodyBlob(body);
  console.log(`[Mock Gateway] Built blob: ${blob.length} bytes (text: ${Buffer.from(body, "utf-8").length} UTF-8 bytes)`);

  // Run the REAL extraction function
  const extracted = extractTextFromAttributedBody(blob);
  console.log(`[Mock Gateway] Extraction result: ${extracted === body ? "MATCH" : "MISMATCH"}`);

  if (extracted !== null && extracted === body) {
    // Extraction succeeded — simulate delivery flow

    // Report SENT
    await fetch(`${API_URL}/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "SENT",
        sentAt: new Date().toISOString(),
      }),
    });

    // Small delay to simulate real-world delivery latency
    await new Promise((r) => setTimeout(r, 100));

    // Report DELIVERED
    await fetch(`${API_URL}/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "DELIVERED",
        deliveredAt: new Date().toISOString(),
      }),
    });

    console.log(`[Mock Gateway] Message ${id} reported as DELIVERED`);
  } else {
    // Extraction failed — report as FAILED
    const errorMessage = extracted === null
      ? "attributedBody extraction returned null"
      : `attributedBody extraction mismatch: expected "${body.slice(0, 50)}..." but got "${extracted.slice(0, 50)}..."`;

    await fetch(`${API_URL}/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "FAILED",
        errorMessage,
      }),
    });

    console.error(`[Mock Gateway] Message ${id} FAILED: ${errorMessage}`);
  }

  return c.json({ success: true, messageId: id, status: "ACCEPTED" });
});

// Graceful shutdown
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

console.log(`[Mock Gateway] Starting on http://localhost:${PORT}`);
console.log(`[Mock Gateway] API URL: ${API_URL}`);

serve({ fetch: app.fetch, port: PORT });
