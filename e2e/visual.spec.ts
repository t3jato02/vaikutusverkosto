import { test, expect, type Page } from "@playwright/test";

// Screenshot visual-regression suite. Baselines live in e2e/visual.spec.ts-snapshots/
// (per project = per viewport/engine). Regenerate deliberately with
//   npx playwright test e2e/visual.spec.ts --update-snapshots
// Dynamic regions (relative timestamps, the graph canvas, the analytics
// "calculated at" line) are masked so real layout regressions still fail but
// data churn does not.
test.describe("visual regression", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "screenshots are pinned to chromium");

  const stabilize = async (page: Page) => {
    await page.addStyleTag({
      content: `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`,
    });
    await page.evaluate(() => document.fonts.ready);
  };
  const masks = (page: Page) => [
    page.locator("time"),
    page.locator("canvas"),
    page.locator("[data-testid='live-region']"),
  ];

  const shot = async (page: Page, path: string, name: string, opts: { fullPage?: boolean } = {}) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await stabilize(page);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: opts.fullPage ?? true,
      mask: masks(page),
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    });
  };

  test("homepage", async ({ page }) => shot(page, "/", "home"));
  test("explore", async ({ page }) => shot(page, "/explore", "explore"));
  test("changes", async ({ page }) => shot(page, "/changes", "changes"));
  test("money", async ({ page }) => shot(page, "/money", "money"));
  test("foreign", async ({ page }) => shot(page, "/foreign", "foreign"));
  test("methodology", async ({ page }) => shot(page, "/methodology", "methodology"));
  test("analytics", async ({ page }) => shot(page, "/analytics", "analytics"));

  test("person profile", async ({ page }) => {
    await page.goto("/search?q=Orpo");
    const href = await page.getByRole("link", { name: /Petteri Orpo/ }).first().getAttribute("href");
    await shot(page, href!, "person");
  });

  test("organization profile", async ({ page }) => {
    await page.goto("/search?q=valiokunta");
    const href = await page.getByRole("link", { name: /valiokunta/i }).first().getAttribute("href");
    await shot(page, href!, "organization");
  });

  test("search palette open", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await stabilize(page);
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "Haku" }).waitFor();
    await page.getByLabel("Hakusana").fill("valiokunta");
    await page.waitForTimeout(800);
    await expect(page.getByRole("dialog", { name: "Haku" })).toHaveScreenshot("palette.png", {
      mask: [page.locator("time")],
      maxDiffPixelRatio: 0.03,
    });
  });
});
