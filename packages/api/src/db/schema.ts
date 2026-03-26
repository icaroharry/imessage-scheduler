import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull(),
  body: text("body").notNull(),
  status: text("status", {
    enum: ["QUEUED", "ACCEPTED", "SENT", "DELIVERED", "FAILED"],
  })
    .notNull()
    .default("QUEUED"),
  scheduledAt: text("scheduled_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  sentAt: text("sent_at"),
  deliveredAt: text("delivered_at"),
  errorMessage: text("error_message"),
});

export const config = sqliteTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Config = typeof config.$inferSelect;
