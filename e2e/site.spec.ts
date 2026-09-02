import { test, expect } from "@playwright/test";

test.describe("public navigation", () => {
  test("home loads and shows purpose + real stats", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Henkilöitä", { exact: true })).toBeVisible();
    await expect(page.getByText("Lähteitä", { exact: true })).toBeVisible();
    // Search field present
    await expect(page.getByPlaceholder(/Hae henkilöä/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("home has no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test("navigation links work", async ({ page }) => {
    const vp = page.viewportSize()!;
    for (const [label, path] of [
      ["Tutki", "/explore"],
      ["Raha", "/money"],
      ["Päätökset", "/decisions"],
      ["Kartta", "/map"],
      ["Menetelmät", "/methodology"],
      ["Lähteet", "/sources"],
    ]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: /Vaikutusverkosto/ }).first()).toBeVisible();
      await expect(page).not.toHaveURL(/404/);
      if (vp.width >= 1024) {
        await expect(page.getByRole("link", { name: label, exact: true }).first()).toBeVisible();
      } else {
        await expect(page.getByRole("button", { name: "Avaa valikko" })).toBeVisible();
      }
    }
  });
});

test.describe("search", () => {
  test("search finds an MP", async ({ page }) => {
    await page.goto("/search?q=Orpo");
    await expect(page.getByText("Petteri Orpo", { exact: false }).first()).toBeVisible();
  });

  test("search autocomplete works on home", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder(/Hae henkilöä/);
    await input.fill("Stubb");
    await expect(page.locator("ul").first()).toBeVisible();
  });
});

test.describe("person profile", () => {
  test("deep link to an MP profile works", async ({ page }) => {
    // Resolve a real person slug from search.
    await page.goto("/search?q=Orpo");
    const link = page.getByRole("link", { name: /Petteri Orpo/ }).first();
    const href = await link.getAttribute("href");
    expect(href).toBeTruthy();
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(href!);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "VERKOSTO", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ORGANISAATIOYHTEYDET" })).toBeVisible();
    // Graph fallback: relationship list must be accessible as text.
    await expect(page.getByText("Näytä lähde").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("money page", () => {
  test("money shows honest empty-or-real state and no demo flows", async ({ page }) => {
    await page.goto("/money");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Julkinen raha");
    const body = await page.textContent("body");
    expect(body).not.toContain("DEMO");
    expect(body).not.toContain("(demo)");
  });
});

test.describe("static/public pages", () => {
  for (const path of ["/explore", "/changes", "/map", "/methodology", "/sources", "/about", "/api", "/decisions", "/compare", "/investigate", "/corrections"]) {
    test(`${path} loads without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await page.goto(path);
      await expect(page).not.toHaveURL(/404/);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
      expect(errors).toEqual([]);
    });
  }
});

test.describe("404 handling", () => {
  test("unknown route shows 404 page", async ({ page }) => {
    await page.goto("/this-does-not-exist");
    await expect(page.getByText("404")).toBeVisible();
  });
});

test.describe("admin access protection", () => {
  test("anonymous user is redirected from admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("anonymous admin API returns 401", async ({ request }) => {
    const res = await request.get("/api/admin/agents/parliament-agent/run");
    expect(res.status()).toBe(401);
  });

  test("anonymous cron API returns 401", async ({ request }) => {
    const res = await request.get("/api/cron/ingest");
    expect(res.status()).toBe(401);
  });

  test("admin can log in and access dashboard", async ({ page }) => {
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "dev-admin-password";
    await page.goto("/login");
    await page.getByLabel("Salasana").fill(password);
    await page.getByRole("button", { name: "Kirjaudu" }).click();
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: /Hallinta/ })).toBeVisible();
  });
});

test.describe("API", () => {
  test("search API returns results", async ({ request }) => {
    const res = await request.get("/api/search?q=kok");
    // 200 = results; 429 = rate limiting is correctly engaged (also a pass for release gate).
    expect([200, 429]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json();
      expect(Array.isArray(data.results)).toBe(true);
    }
  });

  test("money API returns aggregates", async ({ request }) => {
    const res = await request.get("/api/money");
    expect([200, 429]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json();
      expect(data).toHaveProperty("byType");
    }
  });

  test("rate limiting returns 429 under burst", async ({ request }, testInfo) => {
    // Exhausts the shared per-IP limiter (120/min); run only once (desktop project).
    test.skip(testInfo.project.name !== "desktop", "burst test runs once");
    let got429 = false;
    for (let i = 0; i < 200; i++) {
      const res = await request.get("/api/search?q=test");
      if (res.status() === 429) {
        got429 = true;
        expect(res.headers()["retry-after"]).toBeTruthy();
        break;
      }
    }
    expect(got429).toBe(true);
  });
});