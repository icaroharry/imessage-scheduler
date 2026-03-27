import type { APIRequestContext } from "@playwright/test";

/**
 * Build a synthetic macOS Messages attributedBody blob from a text string.
 *
 * Mimics the typedstream format that macOS writes to chat.db's attributedBody
 * column. The real `extractTextFromAttributedBody` function in the gateway
 * package is used to extract the text back out — this verifies the extraction
 * works end-to-end.
 *
 * Format:
 *   [typedstream header]
 *   [class hierarchy: NSMutableAttributedString, NSAttributedString, NSObject]
 *   [NSString preamble]
 *   0x84 0x01 0x2b  (marker: new blob, 1-byte type tag, "+" = unshared string)
 *   <length>         (single byte if < 128, 0x81 + 16-bit LE, or 0x82 + 32-bit LE)
 *   <UTF-8 text>
 *   [trailer]
 */
export function buildAttributedBodyBlob(text: string): Buffer {
  const textBuf = Buffer.from(text, "utf-8");

  // Typedstream marker
  const marker = Buffer.from([0x84, 0x01, 0x2b]);

  // Length encoding
  let lengthBuf: Buffer;
  if (textBuf.length < 0x80) {
    lengthBuf = Buffer.from([textBuf.length]);
  } else if (textBuf.length <= 0xffff) {
    lengthBuf = Buffer.alloc(3);
    lengthBuf[0] = 0x81;
    lengthBuf.writeUInt16LE(textBuf.length, 1);
  } else {
    lengthBuf = Buffer.alloc(5);
    lengthBuf[0] = 0x82;
    lengthBuf.writeUInt32LE(textBuf.length, 1);
  }

  // Realistic typedstream header and class hierarchy
  const header = Buffer.concat([
    Buffer.from([0x04, 0x0b]),              // version
    Buffer.from("streamtyped"),              // magic
    Buffer.from([0x81, 0xe8, 0x03]),         // system id 1000
    Buffer.from([0x84, 0x84]),               // class hierarchy markers
    Buffer.from("NSMutableAttributedString"),
    Buffer.from([0x00]),
    Buffer.from("NSAttributedString"),
    Buffer.from([0x00]),
    Buffer.from("NSObject"),
    Buffer.from([0x00, 0x85, 0x84]),         // end-of-hierarchy markers
    Buffer.from("NSString"),
    Buffer.from([0x00, 0x01, 0x94]),         // NSString preamble
  ]);

  const trailer = Buffer.from([0x86, 0x84, 0x00]);

  return Buffer.concat([header, marker, lengthBuf, textBuf, trailer]);
}

/**
 * Poll GET /messages/:id until the message reaches the target status
 * or times out.
 */
export async function waitForStatus(
  request: APIRequestContext,
  messageId: number,
  targetStatus: string,
  timeoutMs: number = 15000,
): Promise<{ status: string; sentAt: string | null; deliveredAt: string | null; errorMessage: string | null }> {
  const start = Date.now();
  const pollInterval = 300;

  while (Date.now() - start < timeoutMs) {
    const res = await request.get(`/messages/${messageId}`);
    const json = await res.json();
    const msg = json.data;

    if (msg.status === targetStatus) {
      return {
        status: msg.status,
        sentAt: msg.sentAt,
        deliveredAt: msg.deliveredAt,
        errorMessage: msg.errorMessage,
      };
    }

    // If we hit a terminal state that isn't our target, fail early
    if (
      (targetStatus === "DELIVERED" && msg.status === "FAILED") ||
      (targetStatus === "SENT" && msg.status === "FAILED")
    ) {
      return {
        status: msg.status,
        sentAt: msg.sentAt,
        deliveredAt: msg.deliveredAt,
        errorMessage: msg.errorMessage,
      };
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  // Timeout — return whatever the current status is
  const res = await request.get(`/messages/${messageId}`);
  const json = await res.json();
  const msg = json.data;
  return {
    status: msg.status,
    sentAt: msg.sentAt,
    deliveredAt: msg.deliveredAt,
    errorMessage: msg.errorMessage,
  };
}
