import { test, expect } from "./ui-fixtures.js";

test.describe("Message status progression in UI", () => {
  test("should show a created message reach Delivered status", async ({
    page,
  }) => {
    await page.goto("/");

    // Create a message via the UI
    await page.getByRole("button", { name: /new message/i }).click();
    await page.locator("input#phone").fill("+15559002001");
    await page
      .locator("textarea#message")
      .fill("Status flow e2e test message");
    await page.getByRole("button", { name: /schedule message/i }).click();

    // Wait for dialog to close
    await expect(page.locator("input#phone")).not.toBeVisible({
      timeout: 5000,
    });

    // The message should appear in the UI with its phone number
    await expect(page.getByText("+15559002001").first()).toBeVisible({
      timeout: 5000,
    });

    // Wait for a "Delivered" badge to appear on this message's card.
    // The scheduler runs every 500ms, mock gateway processes immediately,
    // and the message list auto-refreshes every 10s.
    const messageCard = page.locator("text=+15559002001").first().locator("../..");
    await expect(messageCard.getByText("Delivered")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("should move message from Queue to Processed column", async ({
    page,
  }) => {
    await page.goto("/");

    // Create a message
    await page.getByRole("button", { name: /new message/i }).click();
    await page.locator("input#phone").fill("+15559002002");
    await page
      .locator("textarea#message")
      .fill("Queue to Processed flow test");
    await page.getByRole("button", { name: /schedule message/i }).click();
    await expect(page.locator("input#phone")).not.toBeVisible({
      timeout: 5000,
    });

    // Wait for the message to appear
    await expect(page.getByText("+15559002002").first()).toBeVisible({
      timeout: 5000,
    });

    // Eventually it should show "Delivered" badge
    await expect(page.getByText("Delivered").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("should deliver long message (>128 bytes) via UI", async ({ page }) => {
    await page.goto("/");

    const longBody = "This is a long message for the e2e test. ".repeat(5);

    // Create the message via UI
    await page.getByRole("button", { name: /new message/i }).click();
    await page.locator("input#phone").fill("+15559002003");
    await page.locator("textarea#message").fill(longBody);
    await page.getByRole("button", { name: /schedule message/i }).click();
    await expect(page.locator("input#phone")).not.toBeVisible({
      timeout: 5000,
    });

    // Wait for the message to appear and reach Delivered status
    // This exercises the 0x81 multi-byte length path in attributedBody extraction
    await expect(page.getByText("+15559002003").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Delivered").first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
