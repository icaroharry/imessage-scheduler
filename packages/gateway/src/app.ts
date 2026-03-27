import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { z } from "zod";
import { sendIMessage, openFullDiskAccessSettings } from "./imessage.js";
import { StatusTracker } from "./status-tracker.js";

const sendMessageSchema = z.object({
  id: z.number(),
  phone: z.string().min(1),
  body: z.string().min(1),
});

export function createGatewayApp(
  apiBaseUrl: string = "http://localhost:3001",
) {
  const app = new Hono() as Hono & { tracker: StatusTracker };
  const tracker = new StatusTracker(apiBaseUrl);

  // Expose tracker for graceful shutdown
  app.tracker = tracker;

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: ["http://localhost:3000", "http://localhost:3001"],
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

  // Open macOS System Settings to Full Disk Access pane
  app.post("/open-fda-settings", async (c) => {
    const opened = await openFullDiskAccessSettings();
    if (opened) {
      return c.json({ success: true, message: "Opened Full Disk Access settings" });
    }
    return c.json(
      { success: false, message: "Could not open settings (not macOS?)" },
      400,
    );
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

    // Capture the timestamp BEFORE calling osascript, so it is guaranteed
    // to be earlier than the chat.db `date` column for this message.
    // Subtract a small buffer (5s) to account for any clock drift between
    // Node.js and the Core Data timestamps Messages.app writes.
    const sentAt = new Date(Date.now() - 5000);

    const result = await sendIMessage(phone, body);

    if (result.success) {
      console.log(`[Gateway] Message ${id} accepted by Messages.app — tracking delivery`);

      // Do NOT report SENT here. osascript succeeding only means Messages.app
      // accepted the command — not that the message was actually sent.
      // The StatusTracker will report the real status (SENT/DELIVERED/FAILED)
      // after confirming via chat.db.
      tracker.trackDelivery({
        messageId: id,
        phone,
        body,
        sentAt,
      });

      return c.json({
        success: true,
        messageId: id,
        status: "ACCEPTED",
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
