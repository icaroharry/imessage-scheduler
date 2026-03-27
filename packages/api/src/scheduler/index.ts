import { eq, asc, lte, or, isNull } from "drizzle-orm";
import { messages, config } from "../db/schema.js";
import type { AppDatabase } from "../db/index.js";

export interface SchedulerOptions {
  db: AppDatabase;
  onSend?: (message: { id: number; phone: string; body: string }) => Promise<boolean>;
}

export class MessageScheduler {
  private db: AppDatabase;
  private timer: ReturnType<typeof setInterval> | null = null;
  private onSend: SchedulerOptions["onSend"];
  private processing = false;

  constructor(options: SchedulerOptions) {
    this.db = options.db;
    this.onSend = options.onSend;
  }

  private getConfig(): { sendIntervalMs: number; gatewayUrl: string } {
    const rows = this.db.select().from(config).all();
    const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      sendIntervalMs: Number(cfg.send_interval_ms) || 3600000,
      gatewayUrl: cfg.gateway_url || "http://localhost:3002",
    };
  }

  /** Pick the next QUEUED message (FIFO by created_at) that is ready to send */
  getNextMessage() {
    const now = new Date().toISOString();

    const result = this.db
      .select()
      .from(messages)
      .where(
        eq(messages.status, "QUEUED"),
      )
      .orderBy(asc(messages.createdAt))
      .limit(1)
      .all();

    if (result.length === 0) return null;

    const msg = result[0];

    // If scheduledAt is set and is in the future, skip
    if (msg.scheduledAt && msg.scheduledAt > now) {
      return null;
    }

    return msg;
  }

  /** Process the next message in the queue */
  async processNext(): Promise<boolean> {
    if (this.processing) return false;
    this.processing = true;

    try {
      const next = this.getNextMessage();
      if (!next) {
        return false;
      }

      // Mark as ACCEPTED
      this.db
        .update(messages)
        .set({
          status: "ACCEPTED",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(messages.id, next.id))
        .run();

      // Try to send via gateway
      try {
        let sent = false;

        if (this.onSend) {
          sent = await this.onSend({
            id: next.id,
            phone: next.phone,
            body: next.body,
          });
        } else {
          // Default: call the gateway HTTP API
          const cfg = this.getConfig();
          const response = await fetch(`${cfg.gatewayUrl}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: next.id,
              phone: next.phone,
              body: next.body,
            }),
          });

          if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gateway error: ${response.status} ${err}`);
          }

          sent = true;
        }

        // The gateway reports final status (SENT/DELIVERED/FAILED) back via
        // the StatusTracker PATCH endpoint. We don't update status here to
        // avoid a race condition where the scheduler overwrites the gateway's
        // already-reported status.

        return true;
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`[Scheduler] Failed to send message ${next.id}:`, errorMsg);

        this.db
          .update(messages)
          .set({
            status: "FAILED",
            errorMessage: errorMsg,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(messages.id, next.id))
          .run();

        return false;
      }
    } finally {
      this.processing = false;
    }
  }

  /** Start the scheduler with the configured interval */
  start(): void {
    if (this.timer) {
      console.warn("[Scheduler] Already running");
      return;
    }

    const cfg = this.getConfig();
    console.log(
      `[Scheduler] Starting with interval: ${cfg.sendIntervalMs}ms (${cfg.sendIntervalMs / 1000 / 60} min)`,
    );

    // Process immediately on start
    this.processNext().catch(console.error);

    this.timer = setInterval(() => {
      this.processNext().catch(console.error);
    }, cfg.sendIntervalMs);
  }

  /** Stop the scheduler */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[Scheduler] Stopped");
    }
  }

  /** Restart with potentially new config */
  restart(): void {
    this.stop();
    this.start();
  }
}
