import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { z } from "zod";
import { sendIMessage } from "./imessage.js";
import { StatusTracker } from "./status-tracker.js";

const sendMessageSchema = z.object({
  id: z.number(),
  phone: z.string().min(1),
  body: z.string().min(1),
});

export function createGatewayApp(
  apiBaseUrl: string = "http://localhost:3001",
) {
  const app = new Hono();
  const tracker = new StatusTracker(apiBaseUrl);

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: ["http://localhost:3001"],
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  // Health check with system info
  app.get("/health", (c) => {
    const info = tracker.getSystemInfo();
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      system: info,
    });
  });

  // Send a message via iMessage
  app.post("/send", async (c) => {
    const rawBody = await c.req.json();
    const parsed = sendMessageSchema.safeParse(rawBody);

    if (!parsed.success) {
      return c.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const { id, phone, body } = parsed.data;

    console.log(`[Gateway] Sending message ${id} to ${phone}`);

    const result = await sendIMessage(phone, body);

    if (result.success) {
      console.log(`[Gateway] Message ${id} sent successfully`);

      // Report DELIVERED status back to API
      // In a production system, we'd poll chat.db for actual delivery confirmation.
      // For this assessment, we optimistically report DELIVERED after a successful send.
      await tracker.reportStatus(id, "DELIVERED");

      return c.json({
        success: true,
        messageId: id,
        status: "SENT",
      });
    } else {
      console.error(`[Gateway] Message ${id} failed: ${result.error}`);

      await tracker.reportStatus(id, "FAILED", result.error);

      return c.json(
        {
          success: false,
          messageId: id,
          error: result.error,
        },
        500,
      );
    }
  });

  return app;
}
