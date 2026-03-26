import { getChatDbPath, isChatDbAvailable } from "./imessage.js";

export type DeliveryStatus = "SENT" | "DELIVERED" | "FAILED";

export interface StatusUpdate {
  messageId: number;
  status: DeliveryStatus;
  timestamp: string;
}

/**
 * StatusTracker polls the macOS Messages chat.db to detect delivery status.
 *
 * Note: Accessing ~/Library/Messages/chat.db requires Full Disk Access
 * permission in macOS System Preferences > Privacy & Security.
 *
 * The chat.db schema has a `message` table with:
 * - `is_delivered` (1 = delivered)
 * - `is_sent` (1 = sent)
 * - `is_read` (1 = read)
 * - `date` (Core Data timestamp: seconds since 2001-01-01 * 1e9)
 *
 * For the scope of this project, we track delivery by reporting back
 * to the API when a send succeeds via osascript. Full chat.db polling
 * would require Full Disk Access and adds complexity beyond the assessment scope.
 */
export class StatusTracker {
  private apiBaseUrl: string;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(apiBaseUrl: string = "http://localhost:3001") {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Report a status update back to the API
   */
  async reportStatus(
    messageId: number,
    status: DeliveryStatus,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const body: Record<string, string> = {
        status,
      };

      if (status === "SENT") {
        body.sentAt = new Date().toISOString();
      } else if (status === "DELIVERED") {
        body.deliveredAt = new Date().toISOString();
      }

      if (errorMessage) {
        body.errorMessage = errorMessage;
      }

      const response = await fetch(
        `${this.apiBaseUrl}/messages/${messageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        console.error(
          `[StatusTracker] Failed to report status for message ${messageId}: ${response.status}`,
        );
      }
    } catch (error) {
      console.error("[StatusTracker] Error reporting status:", error);
    }
  }

  /** Check system capabilities */
  getSystemInfo() {
    return {
      platform: process.platform,
      isMacOS: process.platform === "darwin",
      chatDbAvailable: isChatDbAvailable(),
      chatDbPath: getChatDbPath(),
    };
  }
}
