import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  workers: 1, // Sequential — tests share the same API server + DB

  projects: [
    {
      name: "api",
      testMatch: "delivery-tracking.test.ts",
      use: { baseURL: "http://localhost:3051" },
    },
    {
      name: "browser",
      testMatch: "ui-*.test.ts",
      use: {
        // Use the existing Next.js dev server (started via `pnpm dev`)
        // API calls are intercepted and redirected to the e2e API via fixtures
        baseURL: "http://localhost:3000",
        ...devices["Desktop Chrome"],
      },
    },
  ],

  webServer: [
    {
      command: "npx tsx api-server.ts",
      port: 3051,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 10_000,
    },
    {
      command: "npx tsx mock-gateway.ts",
      port: 3052,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 10_000,
    },
  ],
});
