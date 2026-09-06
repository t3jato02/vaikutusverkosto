import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// WCAG 2.2 AA automatic checks on the key pages and interactive states.
// Runs on the chromium viewport projects only (engine-independent).
test.describe("accessibility (axe)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "axe runs once per viewport on chromium");

  const analyze = (page: import("@playwright/test").Page) =>
    new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();

  for (const [name, path] of [
    ["homepage", "/"],
    ["explore", "/explore"],
    ["changes", "/changes"],
    ["money", "/money"],
    ["foreign", "/foreign"],
    ["methodology", "/methodology"],
    ["analytics", "/analytics"],
  ] as const) {
    test(`${name} has no serious/critical axe violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await analyze(page);
      const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        blocking,
        blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`).join("\n"),
      ).toEqual([]);
    });
  }

  test("search palette (open) has no serious/critical axe violations", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "Haku" }).waitFor();
    await page.getByLabel("Hakusana").fill("valiokunta");
    await page.waitForTimeout(700);
    const results = await analyze(page);
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test("evidence drawer (open) has no serious/critical axe violations", async ({ page }) => {
    await page.goto("/search?q=Orpo");
    const link = page.getByRole("link", { name: /Petteri Orpo/ }).first();
    await page.goto((await link.getAttribute("href"))!);
    const btn = page.getByRole("button", { name: "Näytä todiste" }).first();
    await btn.waitFor();
    await btn.click();
    await page.getByRole("dialog").waitFor();
    const results = await analyze(page);
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test("mobile navigation sheet has no serious/critical axe violations", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Avaa valikko" }).click();
    await page.getByRole("navigation", { name: "Mobiilivalikko" }).waitFor();
    const results = await analyze(page);
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
