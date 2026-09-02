import { defineConfig } from "@playwright/test";

// E2E release gate. Default target: local production server (npm run start).
// For production verification: PLAYWRIGHT_BASE_URL=https://<deployed-url> npm run e2e
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// All projects run on Chromium; the suite tests responsiveness across viewport
// widths (320/390/768/1440), not browser-engine differences.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
    { name: "small-mobile", use: { viewport: { width: 320, height: 568 } } },
  ],
});