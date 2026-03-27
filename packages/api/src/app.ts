import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { messagesRouter } from "./routes/messages.js";
import { configRouter } from "./routes/config.js";
import { eventsRouter } from "./routes/events.js";
import type { AppDatabase } from "./db/index.js";
import { config } from "./db/schema.js";

type Env = {
  Variables: {
    db: AppDatabase;
  };
};

export function createApp(db: AppDatabase) {
  const app = new Hono<Env>();

  // Middleware
  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: [
        "http://localhost:3000",
        "http://localhost:3001",
      ],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  // Inject database into context
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });

  // Health check
  app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Routes
  app.route("/messages", messagesRouter);
  app.route("/config", configRouter);
  app.route("/events", eventsRouter);

  // Proxy gateway health so the browser doesn't need direct access to the gateway
  app.get("/gateway/health", async (c) => {
    const db = c.get("db");
    const rows = db.select().from(config).all();
    const cfg = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
    const gatewayUrl = cfg.gateway_url || "http://localhost:3002";

    try {
      const res = await fetch(`${gatewayUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return c.json(data);
    } catch {
      return c.json({ status: "offline" }, 503);
    }
  });

  // Proxy gateway open-fda-settings
  app.post("/gateway/open-fda-settings", async (c) => {
    const db = c.get("db");
    const rows = db.select().from(config).all();
    const cfg = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
    const gatewayUrl = cfg.gateway_url || "http://localhost:3002";

    try {
      const res = await fetch(`${gatewayUrl}/open-fda-settings`, {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return c.json(data, res.ok ? 200 : 400);
    } catch {
      return c.json({ success: false, message: "Gateway unreachable" }, 503);
    }
  });

  // 404 handler
  app.notFound((c) => {
    return c.json({ error: "Not found" }, 404);
  });

  // Error handler
  app.onError((err, c) => {
    console.error("[API Error]", err);
    return c.json(
      {
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      500,
    );
  });

  return app;
}
