import { getChatDbPath, isChatDbAvailable, isChatDbReadable } from "./imessage.js";
import { checkDelivery } from "./delivery-tracker.js";

export type DeliveryStatus = "SENT" | "DELIVERED" | "FAILED";

export interface StatusUpdate {
  messageId: number;
  status: DeliveryStatus;
  timestamp: string;
}

/** Options for delivery polling */
interface TrackDeliveryOptions {
  /** Our internal message ID */
  messageId: number;
  /** Recipient phone number */
  phone: string;
  /** Message text */
  body: string;
  /** When the message was sent (used to scope the chat.db query) */
  sentAt: Date;
  /** How often to poll chat.db (default: 2000ms) */
  pollIntervalMs?: number;
  /** How long to poll before giving up (default: 60000ms / 1 min) */
  timeoutMs?: number;
}

/**
 * StatusTracker reports delivery status back to the API and polls
 * ~/Library/Messages/chat.db for real delivery confirmation.
 *
 * Accessing chat.db requires Full Disk Access permission in
 * macOS System Settings > Privacy & Security > Full Disk Access.
 */
export class StatusTracker {
  private apiBaseUrl: string;
  /** Active polling timers, keyed by message ID */
  private activePolls = new Map<number, ReturnType<typeof setInterval>>();

  constructor(apiBaseUrl: string = "http://localhost:3001") {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Report a status update back to the API, with retry on failure.
   *
   * Retries up to 3 times with exponential backoff (1s, 2s, 4s) to
   * prevent transient network errors from silently losing status updates.
   */
  async reportStatus(
    messageId: number,
    status: DeliveryStatus,
    errorMessage?: string,
  ): Promise<void> {
    const body: Record<string, string> = { status };

    if (status === "SENT") {
      body.sentAt = new Date().toISOString();
    } else if (status === "DELIVERED") {
      body.deliveredAt = new Date().toISOString();
    }

    if (errorMessage) {
      body.errorMessage = errorMessage;
    }

    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(
          `${this.apiBaseUrl}/messages/${messageId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );

        if (response.ok) return; // success

        console.error(
          `[StatusTracker] Failed to report ${status} for message ${messageId}: HTTP ${response.status} (attempt ${attempt}/${maxRetries})`,
        );
      } catch (error) {
        console.error(
          `[StatusTracker] Error reporting ${status} for message ${messageId} (attempt ${attempt}/${maxRetries}):`,
          error,
        );
      }

      // Wait before retrying (exponential backoff: 1s, 2s, 4s)
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      }
    }

    console.error(
      `[StatusTracker] GAVE UP reporting ${status} for message ${messageId} after ${maxRetries} attempts`,
    );
  }

  /**
   * Start polling chat.db for delivery confirmation of a specific message.
   *
   * This is the sole authority for status transitions after the gateway
   * accepts a message. The progression is:
   *
   *   (ACCEPTED) → SENT → DELIVERED
   *                  ↘       ↗
   *                  FAILED
   *
   * - SENT: message found in chat.db with is_sent=1
   * - DELIVERED: message found with is_delivered=1
   * - FAILED: message found with sendFailed=true, or not found after timeout
   *
   * If chat.db is not accessible (no Full Disk Access), immediately reports
   * SENT (we know osascript succeeded) then DELIVERED optimistically.
   */
  trackDelivery(options: TrackDeliveryOptions): void {
    const {
      messageId,
      phone,
      body,
      sentAt,
      pollIntervalMs = 2000,
      timeoutMs = 60000,
    } = options;

    // If chat.db is not available, fall back to optimistic: SENT then DELIVERED
    if (!isChatDbAvailable()) {
      console.log(
        `[StatusTracker] chat.db not available — reporting DELIVERED optimistically for message ${messageId}`,
      );
      this.reportStatus(messageId, "SENT").then(() =>
        this.reportStatus(messageId, "DELIVERED"),
      );
      return;
    }

    console.log(
      `[StatusTracker] Tracking delivery for message ${messageId} (timeout: ${timeoutMs / 1000}s)`,
    );

    const startTime = Date.now();
    let attempts = 0;
    let reportedSent = false;

    const poll = () => {
      attempts++;
      const elapsed = Date.now() - startTime;

      // Check timeout
      if (elapsed >= timeoutMs) {
        this.stopTracking(messageId);

        // Do a final check — if chat.db shows sendFailed, report FAILED
        const finalResult = checkDelivery(phone, body, sentAt);
        if (finalResult.found && finalResult.sendFailed) {
          console.log(
            `[StatusTracker] Message ${messageId} FAILED on timeout — Messages.app could not send`,
          );
          this.reportStatus(
            messageId,
            "FAILED",
            "Messages.app failed to deliver — recipient may not use iMessage",
          );
          return;
        }

        if (finalResult.found && finalResult.delivered) {
          console.log(
            `[StatusTracker] Message ${messageId} confirmed DELIVERED on final check (rowid: ${finalResult.rowid})`,
          );
          if (!reportedSent) this.reportStatus(messageId, "SENT");
          this.reportStatus(messageId, "DELIVERED");
          return;
        }

        // Message not found in chat.db at all after the full timeout — this
        // means either: (a) the sentAt filter excluded it, (b) Messages.app
        // silently dropped it, or (c) chat.db is out of sync. In any case,
        // we cannot confirm delivery, so report FAILED rather than lying
        // with an optimistic DELIVERED.
        if (!finalResult.found) {
          console.warn(
            `[StatusTracker] Message ${messageId} NOT FOUND in chat.db after ${attempts} attempts (${elapsed / 1000}s) — reporting FAILED`,
          );
          this.reportStatus(
            messageId,
            "FAILED",
            "Message not found in Messages.app — delivery could not be confirmed",
          );
          return;
        }

        // Found but not delivered and not sendFailed — in transit. Report SENT.
        console.warn(
          `[StatusTracker] Delivery tracking timed out for message ${messageId} after ${attempts} attempts (${elapsed / 1000}s) — message in transit`,
        );
        if (!reportedSent) this.reportStatus(messageId, "SENT");
        return;
      }

      const result = checkDelivery(phone, body, sentAt);

      // If chat.db became inaccessible mid-poll, bail with optimistic DELIVERED
      if (result.accessError) {
        console.warn(
          `[StatusTracker] chat.db access lost for message ${messageId} — reporting DELIVERED optimistically`,
        );
        this.stopTracking(messageId);
        if (!reportedSent) this.reportStatus(messageId, "SENT");
        this.reportStatus(messageId, "DELIVERED");
        return;
      }

      if (result.found) {
        // Only report SENT when is_sent=1 (not sendFailed).
        // If sendFailed is true (is_sent=0), the message was never actually
        // sent, so skip straight to FAILED — never show a misleading "Sent".
        if (!reportedSent && !result.sendFailed) {
          reportedSent = true;
          console.log(
            `[StatusTracker] Message ${messageId} confirmed SENT in chat.db (rowid: ${result.rowid}, attempt: ${attempts})`,
          );
          this.reportStatus(messageId, "SENT");
        }

        if (result.delivered) {
          console.log(
            `[StatusTracker] Message ${messageId} confirmed DELIVERED in chat.db (rowid: ${result.rowid}, attempt: ${attempts})`,
          );
          this.stopTracking(messageId);
          if (!reportedSent) {
            reportedSent = true;
            this.reportStatus(messageId, "SENT");
          }
          this.reportStatus(messageId, "DELIVERED");
          return;
        }

        // Messages.app shows is_sent=0 AND is_delivered=0 — the send failed
        // (recipient doesn't have iMessage, network error, etc.)
        // Give it a few seconds before declaring failure, as the DB may lag
        if (result.sendFailed && elapsed >= 10000) {
          console.log(
            `[StatusTracker] Message ${messageId} FAILED — Messages.app could not send (is_sent=0, is_delivered=0, rowid: ${result.rowid})`,
          );
          this.stopTracking(messageId);
          this.reportStatus(
            messageId,
            "FAILED",
            "Messages.app failed to deliver — recipient may not use iMessage",
          );
          return;
        }
        // Found but not yet delivered/failed — keep polling
      }
      // Not found yet — keep polling (Messages.app may still be writing to chat.db)
    };

    // Do an initial check immediately
    const immediateResult = checkDelivery(phone, body, sentAt);
    if (immediateResult.accessError) {
      console.log(
        `[StatusTracker] chat.db not readable — reporting DELIVERED optimistically for message ${messageId}`,
      );
      this.reportStatus(messageId, "SENT").then(() =>
        this.reportStatus(messageId, "DELIVERED"),
      );
      return;
    }
    if (immediateResult.found && immediateResult.delivered) {
      console.log(
        `[StatusTracker] Message ${messageId} already DELIVERED in chat.db`,
      );
      this.reportStatus(messageId, "SENT").then(() =>
        this.reportStatus(messageId, "DELIVERED"),
      );
      return;
    }

    // Start polling
    const timer = setInterval(poll, pollIntervalMs);
    this.activePolls.set(messageId, timer);
  }

  /** Stop polling for a specific message */
  private stopTracking(messageId: number): void {
    const timer = this.activePolls.get(messageId);
    if (timer) {
      clearInterval(timer);
      this.activePolls.delete(messageId);
    }
  }

  /** Stop all active polls (for graceful shutdown) */
  stopAll(): void {
    for (const [messageId, timer] of this.activePolls) {
      clearInterval(timer);
      console.log(`[StatusTracker] Stopped tracking message ${messageId}`);
    }
    this.activePolls.clear();
  }

  /** Check system capabilities */
  getSystemInfo() {
    return {
      platform: process.platform,
      isMacOS: process.platform === "darwin",
      chatDbAvailable: isChatDbAvailable(),
      chatDbReadable: isChatDbReadable(),
      chatDbPath: getChatDbPath(),
    };
  }
}
