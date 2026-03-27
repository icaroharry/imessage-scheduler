import { test as base } from "@playwright/test";

/**
 * Custom test fixture for browser e2e tests.
 *
 * Intercepts all API calls from the web app (localhost:3001) and redirects
 * them to the e2e API server (localhost:3051). This lets browser tests use
 * the existing Next.js dev server on port 3000 while talking to an isolated
 * in-memory test database.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Intercept API requests and redirect to the e2e API server
    await page.route("http://localhost:3001/**", async (route) => {
      const originalUrl = route.request().url();
      const redirectedUrl = originalUrl.replace(
        "http://localhost:3001",
        "http://localhost:3051",
      );
      const response = await route.fetch({ url: redirectedUrl });
      await route.fulfill({ response });
    });

    // Intercept gateway health checks and redirect to mock gateway
    await page.route("http://localhost:3002/**", async (route) => {
      const originalUrl = route.request().url();
      const redirectedUrl = originalUrl.replace(
        "http://localhost:3002",
        "http://localhost:3052",
      );
      try {
        const response = await route.fetch({ url: redirectedUrl });
        await route.fulfill({ response });
      } catch {
        // Mock gateway might not handle all gateway endpoints
        await route.fulfill({ status: 503, body: '{"error":"mock"}' });
      }
    });

    await use(page);
  },
});

export { expect } from "@playwright/test";
