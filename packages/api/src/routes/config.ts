import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { config } from "../db/schema.js";
import type { AppDatabase } from "../db/index.js";

type Env = {
  Variables: {
    db: AppDatabase;
  };
};

const updateConfigSchema = z.object({
  sendIntervalMs: z.number().min(1000).max(86400000).optional(),
  gatewayUrl: z.string().url().optional(),
});

export const configRouter = new Hono<Env>()
  .get("/", async (c) => {
    const db = c.get("db");
    const rows = await db.select().from(config);
    const result = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return c.json({
      data: {
        sendIntervalMs: Number(result.send_interval_ms) || 3600000,
        gatewayUrl: result.gateway_url || "http://localhost:3002",
      },
    });
  })
  .patch("/", async (c) => {
    const db = c.get("db");
    const rawBody = await c.req.json();
    const parsed = updateConfigSchema.safeParse(rawBody);

    if (!parsed.success) {
      return c.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        400,
      );
    }

    if (parsed.data.sendIntervalMs !== undefined) {
      db.update(config)
        .set({ value: String(parsed.data.sendIntervalMs) })
        .where(eq(config.key, "send_interval_ms"))
        .run();
    }

    if (parsed.data.gatewayUrl !== undefined) {
      db.update(config)
        .set({ value: parsed.data.gatewayUrl })
        .where(eq(config.key, "gateway_url"))
        .run();
    }

    // Return updated config
    const rows = await db.select().from(config);
    const result = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return c.json({
      data: {
        sendIntervalMs: Number(result.send_interval_ms) || 3600000,
        gatewayUrl: result.gateway_url || "http://localhost:3002",
      },
    });
  });
