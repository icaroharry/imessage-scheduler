import type { SSEStreamingApi } from "hono/streaming";
import type { Message } from "./db/schema.js";

// ── Event types ──────────────────────────────────────────────────────────

export interface Stats {
  total: number;
  queued: number;
  accepted: number;
  sent: number;
  delivered: number;
  failed: number;
}

export type SSEEvent =
  | { type: "message:created"; data: Message }
  | { type: "message:updated"; data: Message }
  | { type: "message:deleted"; data: { id: number } }
  | { type: "stats:updated"; data: Stats }
  | { type: "gateway:status"; data: { status: "online" | "offline" } };

// ── Client registry ─────────────────────────────────────────────────────

const clients = new Set<SSEStreamingApi>();

export function addClient(stream: SSEStreamingApi): void {
  clients.add(stream);
  console.log(`[SSE] Client connected (${clients.size} total)`);
}

export function removeClient(stream: SSEStreamingApi): void {
  clients.delete(stream);
  console.log(`[SSE] Client disconnected (${clients.size} total)`);
}

export function getClientCount(): number {
  return clients.size;
}

// ── Broadcast ───────────────────────────────────────────────────────────

export function emit(event: SSEEvent): void {
  const payload = JSON.stringify(event.data);
  const dead: SSEStreamingApi[] = [];

  for (const client of clients) {
    client.writeSSE({ event: event.type, data: payload }).catch(() => {
      // Client disconnected — mark for removal
      dead.push(client);
    });
  }

  // Clean up dead connections
  for (const client of dead) {
    removeClient(client);
  }
}
