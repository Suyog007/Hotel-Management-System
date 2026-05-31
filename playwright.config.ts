import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config. Requires `@playwright/test` + browsers:
 *   npm i -D @playwright/test && npx playwright install
 *
 * Run against a local app + LOCAL/test Supabase (never prod):
 *   npm run test:e2e
 * The webServer block boots `npm run dev` automatically if nothing is on :4000.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
