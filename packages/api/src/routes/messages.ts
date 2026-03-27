import { Hono } from "hono";
import { z } from "zod";
import { eq, desc, sql, count, inArray } from "drizzle-orm";
import { messages } from "../db/schema.js";
import type { AppDatabase } from "../db/index.js";
import { emit } from "../events.js";
import type { Stats } from "../events.js";

type Env = {
  Variables: {
    db: AppDatabase;
  };
};

const createMessageSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone number is required")
    .regex(/^\+?[\d\s()-]+$/, "Invalid phone number format"),
  body: z
    .string()
    .min(1, "Message body is required")
    .max(2000, "Message too long"),
  scheduledAt: z.string().datetime().optional(),
});

const updateMessageSchema = z.object({
  status: z
    .enum(["QUEUED", "ACCEPTED", "SENT", "DELIVERED", "FAILED"])
    .optional(),
  errorMessage: z.string().nullable().optional(),
  sentAt: z.string().datetime().nullable().optional(),
  deliveredAt: z.string().datetime().nullable().optional(),
});

/** Compute aggregated stats — shared between the route handler and SSE emission */
export function computeStats(db: AppDatabase): Stats {
  const rows = db
    .select({ status: messages.status, count: count() })
    .from(messages)
    .groupBy(messages.status)
    .all();

  const total = rows.reduce((acc, s) => acc + s.count, 0);
  const byStatus = Object.fromEntries(rows.map((s) => [s.status, s.count]));

  return {
    total,
    queued: byStatus.QUEUED || 0,
    accepted: byStatus.ACCEPTED || 0,
    sent: byStatus.SENT || 0,
    delivered: byStatus.DELIVERED || 0,
    failed: byStatus.FAILED || 0,
  };
}

export const messagesRouter = new Hono<Env>()
  // List all messages with optional status filter (supports comma-separated statuses)
  .get("/", async (c) => {
    const db = c.get("db");
    const statusParam = c.req.query("status");
    const limit = Number(c.req.query("limit")) || 50;
    const offset = Number(c.req.query("offset")) || 0;

    const statuses = statusParam
      ? (statusParam.split(",") as (
          | "QUEUED"
          | "ACCEPTED"
          | "SENT"
          | "DELIVERED"
          | "FAILED"
        )[])
      : undefined;

    let query = db.select().from(messages).orderBy(desc(messages.createdAt));
    let countQuery = db.select({ count: count() }).from(messages);

    if (statuses && statuses.length === 1) {
      query = query.where(eq(messages.status, statuses[0])) as typeof query;
      countQuery = countQuery.where(
        eq(messages.status, statuses[0]),
      ) as typeof countQuery;
    } else if (statuses && statuses.length > 1) {
      query = query.where(
        inArray(messages.status, statuses),
      ) as typeof query;
      countQuery = countQuery.where(
        inArray(messages.status, statuses),
      ) as typeof countQuery;
    }

    const result = await query.limit(limit).offset(offset);
    const [total] = await countQuery;

    return c.json({
      data: result,
      pagination: {
        total: total.count,
        limit,
        offset,
        hasMore: offset + result.length < total.count,
      },
    });
  })

  // Get a single message
  .get("/:id", async (c) => {
    const db = c.get("db");
    const id = Number(c.req.param("id"));

    if (isNaN(id)) {
      return c.json({ error: "Invalid message ID" }, 400);
    }

    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id));

    if (result.length === 0) {
      return c.json({ error: "Message not found" }, 404);
    }

    return c.json({ data: result[0] });
  })

  // Create a new scheduled message
  .post("/", async (c) => {
    const db = c.get("db");
    const rawBody = await c.req.json();
    const parsed = createMessageSchema.safeParse(rawBody);

    if (!parsed.success) {
      return c.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const { phone, body, scheduledAt } = parsed.data;

    const result = db
      .insert(messages)
      .values({
        phone,
        body,
        scheduledAt: scheduledAt || null,
        status: "QUEUED",
      })
      .returning()
      .get();

    emit({ type: "message:created", data: result });
    emit({ type: "stats:updated", data: computeStats(db) });

    return c.json({ data: result }, 201);
  })

  // Update a message (status, error, etc.)
  .patch("/:id", async (c) => {
    const db = c.get("db");
    const id = Number(c.req.param("id"));

    if (isNaN(id)) {
      return c.json({ error: "Invalid message ID" }, 400);
    }

    const rawBody = await c.req.json();
    const parsed = updateMessageSchema.safeParse(rawBody);

    if (!parsed.success) {
      return c.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const existing = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id));

    if (existing.length === 0) {
      return c.json({ error: "Message not found" }, 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.errorMessage !== undefined) {
      updateData.errorMessage = parsed.data.errorMessage;
    }
    if (parsed.data.sentAt !== undefined) updateData.sentAt = parsed.data.sentAt;
    if (parsed.data.deliveredAt !== undefined) {
      updateData.deliveredAt = parsed.data.deliveredAt;
    }

    const result = db
      .update(messages)
      .set(updateData)
      .where(eq(messages.id, id))
      .returning()
      .get();

    emit({ type: "message:updated", data: result });
    emit({ type: "stats:updated", data: computeStats(db) });

    return c.json({ data: result });
  })

  // Delete a message (only if QUEUED)
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const id = Number(c.req.param("id"));

    if (isNaN(id)) {
      return c.json({ error: "Invalid message ID" }, 400);
    }

    const existing = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id));

    if (existing.length === 0) {
      return c.json({ error: "Message not found" }, 404);
    }

    if (existing[0].status !== "QUEUED") {
      return c.json(
        { error: "Can only delete messages with QUEUED status" },
        409,
      );
    }

    db.delete(messages).where(eq(messages.id, id)).run();

    emit({ type: "message:deleted", data: { id } });
    emit({ type: "stats:updated", data: computeStats(db) });

    return c.json({ message: "Message deleted" });
  })

  // Get dashboard stats
  .get("/stats/summary", async (c) => {
    const db = c.get("db");
    return c.json({ data: computeStats(db) });
  });
