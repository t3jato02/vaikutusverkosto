import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

// E2E release gate. Default target: local production server (npm run start).
// For production verification: PLAYWRIGHT_BASE_URL=https://<deployed-url> npm run e2e
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// The suite exercises responsiveness across viewport widths (320/390/768/1440)
// on Chromium, plus WebKit (Safari compatibility proxy) at two widths, plus —
// when PLAYWRIGHT_EDGE=1 and the browser is installed — real Microsoft Edge.
// This catches engine-specific layout / focus / sticky-header / drawer /
// graph-sizing issues.
const projects: NonNullable<PlaywrightTestConfig["projects"]> = [
  { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
  { name: "tablet", use: { browserName: "chromium", viewport: { width: 768, height: 1024 } } },
  { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 } } },
  { name: "small-mobile", use: { browserName: "chromium", viewport: { width: 320, height: 568 } } },
  { name: "webkit-desktop", use: { browserName: "webkit", viewport: { width: 1440, height: 900 } } },
  { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
];
if (process.env.PLAYWRIGHT_EDGE === "1") {
  projects.push({
    name: "edge-desktop",
    use: { browserName: "chromium", channel: "msedge", viewport: { width: 1440, height: 900 } },
  });
}

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
  projects,
});
