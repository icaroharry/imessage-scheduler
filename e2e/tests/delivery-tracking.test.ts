import { test, expect } from "@playwright/test";
import { waitForStatus } from "../helpers.js";

test.describe("Delivery tracking with attributedBody extraction", () => {
  test("short message (< 128 bytes) is delivered successfully", async ({
    request,
  }) => {
    const body = "Hello, this is a short test message!";
    expect(Buffer.from(body, "utf-8").length).toBeLessThan(128);

    // Create message
    const createRes = await request.post("/messages", {
      data: { phone: "+15551234567", body },
    });
    expect(createRes.status()).toBe(201);

    const created = await createRes.json();
    const messageId = created.data.id;
    expect(created.data.status).toBe("QUEUED");

    // Wait for delivery
    const result = await waitForStatus(request, messageId, "DELIVERED");

    expect(result.status).toBe("DELIVERED");
    expect(result.sentAt).toBeTruthy();
    expect(result.deliveredAt).toBeTruthy();
  });

  test("long message (200 chars, 0x81 16-bit length path) is delivered successfully", async ({
    request,
  }) => {
    const body = "A".repeat(200);
    expect(Buffer.from(body, "utf-8").length).toBeGreaterThanOrEqual(128);

    const createRes = await request.post("/messages", {
      data: { phone: "+15551234567", body },
    });
    expect(createRes.status()).toBe(201);

    const created = await createRes.json();
    const messageId = created.data.id;

    const result = await waitForStatus(request, messageId, "DELIVERED");

    expect(result.status).toBe("DELIVERED");
    expect(result.sentAt).toBeTruthy();
    expect(result.deliveredAt).toBeTruthy();
  });

  test("long message with emoji (multi-byte UTF-8, > 128 bytes) is delivered successfully", async ({
    request,
  }) => {
    // 100 ASCII chars + emoji = well over 128 UTF-8 bytes
    // Each emoji is 4 bytes in UTF-8, so 10 emoji = 40 extra bytes
    const body =
      "This is a test message with emoji characters: " +
      "\u{1F600}\u{1F389}\u{1F680}\u{2764}\u{FE0F}\u{1F44D}\u{1F31F}\u{1F525}\u{1F4A1}\u{1F308} " +
      "and some more text to make it longer for the encoding test!";
    expect(Buffer.from(body, "utf-8").length).toBeGreaterThanOrEqual(128);

    const createRes = await request.post("/messages", {
      data: { phone: "+15551234567", body },
    });
    expect(createRes.status()).toBe(201);

    const created = await createRes.json();
    const messageId = created.data.id;

    const result = await waitForStatus(request, messageId, "DELIVERED");

    expect(result.status).toBe("DELIVERED");
    expect(result.sentAt).toBeTruthy();
    expect(result.deliveredAt).toBeTruthy();
  });

  test("very long message (500 chars) is delivered successfully", async ({
    request,
  }) => {
    const body = "B".repeat(500);
    expect(Buffer.from(body, "utf-8").length).toBe(500);

    const createRes = await request.post("/messages", {
      data: { phone: "+15551234567", body },
    });
    expect(createRes.status()).toBe(201);

    const created = await createRes.json();
    const messageId = created.data.id;

    const result = await waitForStatus(request, messageId, "DELIVERED");

    expect(result.status).toBe("DELIVERED");
    expect(result.sentAt).toBeTruthy();
    expect(result.deliveredAt).toBeTruthy();
  });
});
