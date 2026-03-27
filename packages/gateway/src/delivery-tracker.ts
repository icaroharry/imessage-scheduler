import Database from "better-sqlite3";
import { getChatDbPath, isChatDbAvailable } from "./imessage.js";

/**
 * Core Data epoch offset: seconds between Unix epoch (1970-01-01) and
 * Core Data epoch (2001-01-01). chat.db stores dates as nanoseconds
 * since 2001-01-01.
 */
const CORE_DATA_EPOCH_OFFSET = 978307200;

/** Convert a JS Date to a Core Data nanosecond timestamp */
function toCoreDataNanos(date: Date): number {
  return (date.getTime() / 1000 - CORE_DATA_EPOCH_OFFSET) * 1e9;
}

export interface DeliveryResult {
  delivered: boolean;
  /** True if the message was found in chat.db at all */
  found: boolean;
  /** True if chat.db could not be opened (e.g. no Full Disk Access) */
  accessError: boolean;
  /**
   * True if Messages.app failed to send the message.
   * Detected when chat.db shows is_sent = 0 AND is_delivered = 0
   * for a message that's been in the DB for a while.
   */
  sendFailed: boolean;
  /** The ROWID of the matched message in chat.db */
  rowid?: number;
}

/**
 * Normalize a phone number to its digits-only form for matching.
 * chat.db stores handles like "+15551234567" but we need flexible matching.
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Extract plain text from a macOS Messages attributedBody blob.
 *
 * Modern macOS (Ventura+) stores message text in the `attributedBody` column
 * as an NSKeyedArchiver binary plist containing an NSAttributedString.
 * The plain text is embedded after a `\x01+` marker: 2 bytes marker,
 * 1 byte length, then UTF-8 text.
 *
 * For messages longer than 127 bytes, the length is encoded differently
 * (multi-byte), so we also fall back to scanning for the text between
 * known markers.
 */
function extractTextFromAttributedBody(blob: Buffer): string | null {
  if (!blob || blob.length === 0) return null;

  // Find the \x01+ marker
  const marker = Buffer.from([0x01, 0x2b]); // \x01+
  const idx = blob.indexOf(marker);
  if (idx < 0) return null;

  const start = idx + 2;
  if (start >= blob.length) return null;

  const lengthByte = blob[start];

  // Simple case: length fits in one byte (< 128)
  if (lengthByte < 128) {
    const textStart = start + 1;
    const textEnd = textStart + lengthByte;
    if (textEnd > blob.length) return null;
    return blob.subarray(textStart, textEnd).toString("utf-8");
  }

  // Multi-byte length (messages > 127 chars): the high bit is set.
  // The low 4 bits indicate how many following bytes encode the length.
  const extraBytes = lengthByte & 0x0f;
  let length = 0;
  for (let i = 0; i < extraBytes; i++) {
    length |= blob[start + 1 + i] << (8 * i);
  }
  const textStart = start + 1 + extraBytes;
  const textEnd = textStart + length;
  if (textEnd > blob.length) return null;
  return blob.subarray(textStart, textEnd).toString("utf-8");
}

/**
 * Query chat.db for a recently sent message matching the given phone + body.
 *
 * Requires Full Disk Access permission on macOS.
 *
 * Modern macOS stores message text in the `attributedBody` blob column
 * rather than the plain `text` column. This function extracts the plain
 * text from the blob for matching.
 *
 * Delivery states in chat.db:
 * - is_sent=1, is_delivered=1 → delivered (iMessage confirmed)
 * - is_sent=1, is_delivered=0 → sent but not yet delivered (in transit)
 * - is_sent=0, is_delivered=0 → Messages.app failed to send (not an iMessage user, network error, etc.)
 */
export function checkDelivery(
  phone: string,
  body: string,
  sentAfter: Date,
): DeliveryResult {
  if (!isChatDbAvailable()) {
    return { delivered: false, found: false, accessError: true, sendFailed: false };
  }

  let db: Database.Database | null = null;

  try {
    db = new Database(getChatDbPath(), { readonly: true });

    const sinceNanos = toCoreDataNanos(sentAfter);
    const normalizedPhone = normalizePhone(phone);

    // Fetch recent outgoing messages to this phone, then match body in JS
    // (because the text is in the attributedBody blob, not the text column)
    const rows = db
      .prepare(
        `
        SELECT m.ROWID, m.text, m.attributedBody, m.is_delivered, m.is_sent, m.date
        FROM message m
        JOIN handle h ON m.handle_id = h.ROWID
        WHERE REPLACE(REPLACE(REPLACE(REPLACE(h.id, '+', ''), '-', ''), ' ', ''), '(', '') LIKE '%' || ? || '%'
          AND m.is_from_me = 1
          AND m.date > ?
        ORDER BY m.date DESC
        LIMIT 20
        `,
      )
      .all(normalizedPhone, sinceNanos) as Array<{
        ROWID: number;
        text: string | null;
        attributedBody: Buffer | null;
        is_delivered: number;
        is_sent: number;
        date: number;
      }>;

    for (const row of rows) {
      // Try plain text column first, then extract from attributedBody
      let messageText = row.text;
      if (!messageText && row.attributedBody) {
        messageText = extractTextFromAttributedBody(row.attributedBody);
      }

      if (messageText?.trim() === body.trim()) {
        return {
          delivered: row.is_delivered === 1,
          found: true,
          accessError: false,
          // is_sent=0 AND is_delivered=0 means Messages.app couldn't send it
          sendFailed: row.is_sent === 0 && row.is_delivered === 0,
          rowid: row.ROWID,
        };
      }
    }

    return { delivered: false, found: false, accessError: false, sendFailed: false };
  } catch (error) {
    // Common: SQLITE_CANTOPEN if Full Disk Access not granted
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("SQLITE_CANTOPEN") || msg.includes("unable to open")) {
      console.warn(
        "[DeliveryTracker] Cannot open chat.db — grant Full Disk Access to this app in System Settings > Privacy & Security > Full Disk Access",
      );
    } else {
      console.error("[DeliveryTracker] Error querying chat.db:", msg);
    }
    return { delivered: false, found: false, accessError: true, sendFailed: false };
  } finally {
    db?.close();
  }
}
