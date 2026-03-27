import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const startNextServer = !!process.env.E2E_START_NEXT;

// In CI browser job, E2E_START_NEXT=true tells Playwright to start the
// Next.js production server. Locally, you run `pnpm dev` yourself.
const webServers: Array<{
  command: string;
  port: number;
  reuseExistingServer: boolean;
  stdout: "pipe";
  stderr: "pipe";
  timeout: number;
}> = [
  {
    command: "npx tsx api-server.ts",
    port: 3051,
    reuseExistingServer: !isCI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 10_000,
  },
  {
    command: "npx tsx mock-gateway.ts",
    port: 3052,
    reuseExistingServer: !isCI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 10_000,
  },
];

if (startNextServer) {
  webServers.push({
    command: "pnpm --filter @imessage-scheduler/web exec next start",
    port: 3000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 30_000,
  });
}

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: isCI ? 1 : 0,
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
        // Locally: existing Next.js dev server via `pnpm dev`
        // CI: Next.js production server started by Playwright (see webServer above)
        baseURL: "http://localhost:3000",
        ...devices["Desktop Chrome"],
      },
    },
  ],

  webServer: webServers,
});
