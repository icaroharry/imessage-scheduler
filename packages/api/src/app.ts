import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { messagesRouter } from "./routes/messages.js";
import { configRouter } from "./routes/config.js";
import type { AppDatabase } from "./db/index.js";

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
      origin: ["http://localhost:3000", "http://localhost:3001"],
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
