import { test, expect } from "./ui-fixtures.js";

test.describe("Settings page", () => {
  test("should display current scheduler config", async ({ page }) => {
    await page.goto("/settings");

    // The scheduler card should be visible
    await expect(page.getByText("Scheduler").first()).toBeVisible();

    // The current send interval should be displayed (e2e API starts with 500ms)
    await expect(page.getByText(/Currently:/)).toBeVisible();

    // The gateway URL input should show the mock gateway URL
    const gatewayInput = page.locator('input[type="url"]');
    await expect(gatewayInput).toHaveValue("http://localhost:3052");
  });

  test("should navigate between pages via sidebar", async ({ page }) => {
    await page.goto("/");

    // Should be on the home page
    await expect(page.getByText("Messages").first()).toBeVisible();

    // Navigate to Settings via sidebar
    await page.getByRole("link", { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText(/Send Interval/)).toBeVisible();

    // Navigate back to Queue (home)
    await page.getByRole("link", { name: "Queue", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  // Run this last — it changes the config in the shared DB
  test("should save updated interval via preset button", async ({ page }) => {
    await page.goto("/settings");

    // Click the "1 min" preset button
    await page.getByRole("button", { name: "1 min" }).click();

    // The interval input should now show 60000
    const intervalInput = page.locator('input[type="number"]');
    await expect(intervalInput).toHaveValue("60000");

    // Save settings
    await page.getByRole("button", { name: /save settings/i }).click();

    // Success message should appear
    await expect(page.getByText(/settings saved/i)).toBeVisible({
      timeout: 5000,
    });
  });
});
