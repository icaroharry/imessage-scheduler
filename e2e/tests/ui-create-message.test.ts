import { test, expect } from "./ui-fixtures.js";

test.describe("Create message via UI", () => {
  test("should create a message and see it appear in the queue", async ({
    page,
  }) => {
    await page.goto("/");

    // Click "New Message" button in the header
    await page.getByRole("button", { name: /new message/i }).click();

    // Dialog should appear with the form
    await expect(
      page.getByText("Enter a phone number and message"),
    ).toBeVisible();

    // Fill in the form
    await page.locator("input#phone").fill("+15559001001");
    await page
      .locator("textarea#message")
      .fill("Hello from Playwright e2e test!");

    // Submit
    await page.getByRole("button", { name: /schedule message/i }).click();

    // Dialog should close and message should appear in the Queue column
    await expect(page.locator("input#phone")).not.toBeVisible({
      timeout: 5000,
    });

    // The message should show up in the queue with phone number and body
    await expect(page.getByText("+15559001001").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText("Hello from Playwright e2e test!").first(),
    ).toBeVisible();
  });

  test("should show validation — submit button disabled when fields empty", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /new message/i }).click();

    // Submit button should be disabled when both fields are empty
    const submitBtn = page.getByRole("button", { name: /schedule message/i });
    await expect(submitBtn).toBeDisabled();

    // Fill only phone — still disabled (no body)
    await page.locator("input#phone").fill("+15559001002");
    await expect(submitBtn).toBeDisabled();

    // Clear phone, fill only body — still disabled
    await page.locator("input#phone").clear();
    await page.locator("textarea#message").fill("Some text");
    await expect(submitBtn).toBeDisabled();

    // Fill both — enabled
    await page.locator("input#phone").fill("+15559001002");
    await expect(submitBtn).toBeEnabled();
  });

  test("should show character counter for message body", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /new message/i }).click();

    // Counter should start at 0/2000
    await expect(page.getByText("0/2000")).toBeVisible();

    // Type some text
    await page.locator("textarea#message").fill("Hello!");
    await expect(page.getByText("6/2000")).toBeVisible();
  });
});
