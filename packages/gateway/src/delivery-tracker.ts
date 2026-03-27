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
 * Typedstream metadata strings that appear in attributedBody blobs
 * but are not message text. Used by the fallback extractor to filter
 * out noise.
 */
const TYPEDSTREAM_METADATA = [
  "streamtyped",
  "NSMutableAttributedString",
  "NSAttributedString",
  "NSMutableString",
  "NSString",
  "NSObject",
  "NSDictionary",
  "NSNumber",
  "NSValue",
  "NSFont",
  "NSParagraphStyle",
  "NSData",
  "NSArray",
  "NSColor",
  "bplist",
  "NSKeyedArchiver",
  "__kIM",
];

/**
 * Extract plain text from a macOS Messages attributedBody blob.
 *
 * Modern macOS (Ventura+) stores message text in the `attributedBody` column
 * as an NSArchiver typedstream containing an NSAttributedString.
 *
 * Primary method: find the typedstream string marker `\x84\x01+` (new data
 * blob → 1-byte type encoding → type `+` = unshared string), then read
 * the length-prefixed UTF-8 text that follows.
 *
 * Length encoding (typedstream integer format):
 * - 0x00–0x7F: literal single-byte value
 * - 0x81: next 2 bytes are a 16-bit little-endian integer
 * - 0x82: next 4 bytes are a 32-bit little-endian integer
 *
 * Fallback: if the marker isn't found, scan for the longest readable
 * UTF-8 segment that isn't a typedstream class name.
 */
export function extractTextFromAttributedBody(blob: Buffer): string | null {
  if (!blob || blob.length === 0) return null;

  // Try structured extraction first, then fall back to text scanning
  return extractViaMarker(blob) ?? extractFallbackText(blob);
}

/**
 * Primary extraction: locate the `0x84 0x01 0x2b` typedstream marker
 * (new-blob, 1-byte type tag, "+" = unshared string) and read the
 * length-prefixed UTF-8 text that follows.
 */
function extractViaMarker(blob: Buffer): string | null {
  const marker = Buffer.from([0x84, 0x01, 0x2b]);
  const idx = blob.indexOf(marker);
  if (idx < 0) return null;

  // Length byte immediately follows the 3-byte marker
  const start = idx + 3;
  if (start >= blob.length) return null;

  const lengthByte = blob[start];

  // Single-byte length (0–127)
  if (lengthByte < 0x80) {
    const textStart = start + 1;
    const textEnd = textStart + lengthByte;
    if (textEnd > blob.length) return null;
    return blob.subarray(textStart, textEnd).toString("utf-8");
  }

  // 0x81 → 16-bit little-endian length (2 bytes follow)
  if (lengthByte === 0x81) {
    if (start + 3 > blob.length) return null;
    const length = blob[start + 1] | (blob[start + 2] << 8);
    const textStart = start + 3;
    const textEnd = textStart + length;
    if (textEnd > blob.length) return null;
    return blob.subarray(textStart, textEnd).toString("utf-8");
  }

  // 0x82 → 32-bit little-endian length (4 bytes follow)
  if (lengthByte === 0x82) {
    if (start + 5 > blob.length) return null;
    const length = blob.readUInt32LE(start + 1);
    const textStart = start + 5;
    const textEnd = textStart + length;
    if (textEnd > blob.length) return null;
    return blob.subarray(textStart, textEnd).toString("utf-8");
  }

  return null;
}

/**
 * Fallback extraction: scan the blob for readable UTF-8 text segments
 * and return the longest one that isn't a typedstream class name.
 *
 * This handles corrupted blobs, format changes, or unusual encoding.
 */
function extractFallbackText(blob: Buffer): string | null {
  const segments: string[] = [];
  let current = "";
  let i = 0;

  while (i < blob.length) {
    const byte = blob[i];

    // Printable ASCII (space through tilde) plus common whitespace
    if ((byte >= 0x20 && byte <= 0x7e) || byte === 0x09 || byte === 0x0a || byte === 0x0d) {
      current += String.fromCharCode(byte);
      i++;
      continue;
    }

    // Multi-byte UTF-8 sequences
    const seqLen = utf8SequenceLength(byte);
    if (seqLen > 1 && i + seqLen <= blob.length) {
      const slice = blob.subarray(i, i + seqLen);
      try {
        const char = slice.toString("utf-8");
        // Verify it decoded to exactly one codepoint (not replacement char)
        if (char.length > 0 && !char.includes("\ufffd")) {
          current += char;
          i += seqLen;
          continue;
        }
      } catch {
        // Invalid sequence, treat as segment boundary
      }
    }

    // Non-text byte: end current segment
    if (current.length > 0) {
      segments.push(current);
      current = "";
    }
    i++;
  }

  if (current.length > 0) {
    segments.push(current);
  }

  // Filter out typedstream metadata and short noise, return longest match
  const cleaned = segments
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && !TYPEDSTREAM_METADATA.includes(s));

  if (cleaned.length === 0) return null;

  // The message body is almost always the longest readable segment
  return cleaned.reduce((a, b) => (a.length >= b.length ? a : b));
}

/** Return the expected byte length of a UTF-8 sequence from its first byte, or 0 if invalid. */
function utf8SequenceLength(byte: number): number {
  if ((byte & 0xe0) === 0xc0) return 2;
  if ((byte & 0xf0) === 0xe0) return 3;
  if ((byte & 0xf8) === 0xf0) return 4;
  return 0;
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
