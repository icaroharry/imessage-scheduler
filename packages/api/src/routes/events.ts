import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { addClient, removeClient, getClientCount, getLastGatewayStatus } from "../events.js";

export const eventsRouter = new Hono()
  .get("/", (c) => {
    return streamSSE(c, async (stream) => {
      addClient(stream);

      // Send an initial "connected" event so the client knows the stream is live
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({
          timestamp: new Date().toISOString(),
          clients: getClientCount(),
        }),
      });

      // Send current gateway status so the client doesn't stay on "Checking..."
      const gwStatus = getLastGatewayStatus();
      if (gwStatus) {
        await stream.writeSSE({
          event: "gateway:status",
          data: JSON.stringify({ status: gwStatus }),
        });
      }

      // Heartbeat every 30s to keep the connection alive through proxies
      const heartbeat = setInterval(() => {
        stream.writeSSE({ event: "ping", data: "" }).catch(() => {
          // Stream is dead — cleanup will happen below
        });
      }, 30_000);

      // Keep the stream open until the client disconnects.
      // The abort signal fires when the client closes the connection.
      try {
        await new Promise<void>((resolve) => {
          stream.onAbort(() => {
            resolve();
          });
        });
      } finally {
        clearInterval(heartbeat);
        removeClient(stream);
      }
    });
  });
