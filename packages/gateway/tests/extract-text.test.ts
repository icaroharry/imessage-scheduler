import { describe, it, expect } from "vitest";
import { extractTextFromAttributedBody } from "../src/delivery-tracker.js";

/**
 * Build a synthetic typedstream-like buffer with the marker + length + text.
 *
 * Real attributedBody blobs have a full typedstream header and class hierarchy
 * before the string data, but the extraction function only cares about the
 * `0x84 0x01 0x2b <length> <text>` portion.
 */
function buildBlob(text: string, options?: { prefix?: Buffer; suffix?: Buffer }): Buffer {
  const textBuf = Buffer.from(text, "utf-8");
  const marker = Buffer.from([0x84, 0x01, 0x2b]);

  let lengthBuf: Buffer;
  if (textBuf.length < 0x80) {
    // Single-byte length
    lengthBuf = Buffer.from([textBuf.length]);
  } else if (textBuf.length <= 0xffff) {
    // 0x81 + 16-bit LE length
    lengthBuf = Buffer.alloc(3);
    lengthBuf[0] = 0x81;
    lengthBuf.writeUInt16LE(textBuf.length, 1);
  } else {
    // 0x82 + 32-bit LE length
    lengthBuf = Buffer.alloc(5);
    lengthBuf[0] = 0x82;
    lengthBuf.writeUInt32LE(textBuf.length, 1);
  }

  // Simulate a realistic blob: some header bytes, then the marker+text, then suffix
  const prefix = options?.prefix ?? Buffer.from([
    0x04, 0x0b, // version
    ...Buffer.from("streamtyped"),
    0x81, 0xe8, 0x03, // system id 1000
    0x84, 0x84, // some class hierarchy bytes
    ...Buffer.from("NSMutableAttributedString"),
    0x00,
    ...Buffer.from("NSAttributedString"),
    0x00,
    ...Buffer.from("NSObject"),
    0x00, 0x85, 0x84,
    ...Buffer.from("NSString"),
    0x00, 0x01, 0x94, // preamble before the actual string data
  ]);
  const suffix = options?.suffix ?? Buffer.from([0x86, 0x84, 0x00]);

  return Buffer.concat([prefix, marker, lengthBuf, textBuf, suffix]);
}

describe("extractTextFromAttributedBody", () => {
  describe("structured marker extraction", () => {
    it("should extract a short message (single-byte length)", () => {
      const result = extractTextFromAttributedBody(buildBlob("Hello"));
      expect(result).toBe("Hello");
    });

    it("should extract a 127-byte message (max single-byte length)", () => {
      const text = "A".repeat(127);
      const result = extractTextFromAttributedBody(buildBlob(text));
      expect(result).toBe(text);
    });

    it("should extract a 128-byte message (16-bit length, 0x81 tag)", () => {
      const text = "B".repeat(128);
      const result = extractTextFromAttributedBody(buildBlob(text));
      expect(result).toBe(text);
    });

    it("should extract a 200-byte message (16-bit length)", () => {
      const text = "C".repeat(200);
      const result = extractTextFromAttributedBody(buildBlob(text));
      expect(result).toBe(text);
    });

    it("should extract a 500-byte message (16-bit length)", () => {
      const text = "D".repeat(500);
      const result = extractTextFromAttributedBody(buildBlob(text));
      expect(result).toBe(text);
    });

    it("should extract a message with emoji (multi-byte UTF-8)", () => {
      // Each emoji is 4 bytes in UTF-8
      const text = "Hello \u{1F600}\u{1F389}\u{1F680}!";
      const result = extractTextFromAttributedBody(buildBlob(text));
      expect(result).toBe(text);
    });

    it("should extract a message with CJK characters", () => {
      const text = "\u3053\u3093\u306B\u3061\u306F\u4E16\u754C";
      const result = extractTextFromAttributedBody(buildBlob(text));
      expect(result).toBe(text);
    });

    it("should extract a message with mixed ASCII and emoji", () => {
      const text = "Hey! \u{1F44B} How are you doing today? \u{2764}\u{FE0F}";
      const result = extractTextFromAttributedBody(buildBlob(text));
      expect(result).toBe(text);
    });

    it("should handle empty text (zero length)", () => {
      const blob = Buffer.concat([
        Buffer.from([0x00, 0x84, 0x01, 0x2b, 0x00]), // marker + length 0
        Buffer.from([0x86]),
      ]);
      const result = extractTextFromAttributedBody(blob);
      expect(result).toBe("");
    });
  });

  describe("edge cases", () => {
    it("should return null for null/empty buffer", () => {
      expect(extractTextFromAttributedBody(Buffer.alloc(0))).toBeNull();
      expect(extractTextFromAttributedBody(null as unknown as Buffer)).toBeNull();
    });

    it("should fall back to text scanning for truncated blob (length exceeds buffer)", () => {
      // Marker says 100 bytes but only 3 available — structured extraction fails,
      // fallback extracts readable ASCII from raw bytes: 0x2b='+', 0x64='d', 0x41-0x43='ABC'
      const blob = Buffer.from([0x84, 0x01, 0x2b, 0x64, 0x41, 0x42, 0x43]);
      expect(extractTextFromAttributedBody(blob)).toBe("+dABC");
    });

    it("should return null for blob with only non-printable bytes", () => {
      const blob = Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x02, 0x03, 0x80]);
      expect(extractTextFromAttributedBody(blob)).toBeNull();
    });

    it("should return null for blob with marker at very end", () => {
      const blob = Buffer.from([0x00, 0x00, 0x84, 0x01, 0x2b]);
      expect(extractTextFromAttributedBody(blob)).toBeNull();
    });

    it("should handle blob with 0x81 length tag but truncated length bytes", () => {
      // 0x81 says 2 length bytes follow, but only 1 available
      const blob = Buffer.from([0x84, 0x01, 0x2b, 0x81, 0x80]);
      expect(extractTextFromAttributedBody(blob)).toBeNull();
    });
  });

  describe("fallback text extraction", () => {
    it("should extract text from blob without the 0x84 0x01 0x2b marker", () => {
      // A blob that has readable text but not the expected marker structure
      const noise = Buffer.from([0x04, 0x0b, 0xff, 0xfe, 0x00]);
      const textBytes = Buffer.from("This is the message body");
      const moreNoise = Buffer.from([0x00, 0xff, 0xfe, 0x86]);
      const blob = Buffer.concat([noise, textBytes, moreNoise]);
      const result = extractTextFromAttributedBody(blob);
      expect(result).toBe("This is the message body");
    });

    it("should return the longest segment, not metadata class names", () => {
      // Simulates a blob with class names and the actual message
      const parts = [
        Buffer.from([0x00]),
        Buffer.from("NSMutableAttributedString"),
        Buffer.from([0x00]),
        Buffer.from("NSObject"),
        Buffer.from([0x00]),
        Buffer.from("This is actually the real message content here"),
        Buffer.from([0x00, 0x86]),
      ];
      const blob = Buffer.concat(parts);
      const result = extractTextFromAttributedBody(blob);
      expect(result).toBe("This is actually the real message content here");
    });

    it("should handle emoji in fallback path", () => {
      const noise = Buffer.from([0xff, 0xfe, 0x00]);
      const textBytes = Buffer.from("Hey \u{1F600}\u{1F389}!");
      const blob = Buffer.concat([noise, textBytes, noise]);
      const result = extractTextFromAttributedBody(blob);
      expect(result).toBe("Hey \u{1F600}\u{1F389}!");
    });

    it("should return null for blob with no readable text", () => {
      const blob = Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x02, 0x03, 0xff]);
      expect(extractTextFromAttributedBody(blob)).toBeNull();
    });
  });
});
