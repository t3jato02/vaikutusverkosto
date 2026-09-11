import { test, expect } from "@playwright/test";

// VAIKUTA full-prototype E2E: register → verify → decision → recipients →
// message (+AI assist) → preview → mock checkout → mock payment →
// confirmation → dashboard → simulated delivery.
//
// The demo decision ("TEST — … (demo)") is created by `npm run ingest:vaikuta:demo`.
// Run the suite with RATE_LIMIT_DISABLED=1 (see release-gate docs).

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@vaikuta.test`;
}

test.describe("VAIKUTA campaign wizard", () => {
  test("full flow from registration to simulated delivery", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    const email = uniqueEmail();
    const password = "e2e-salasana-2026";

    // 1. Register + verify (prototype shows the verification link inline).
    await page.goto("/vaikuta/auth/register");
    await page.getByLabel("Sähköposti").fill(email);
    await page.getByLabel(/Salasana/).fill(password);
    await page.getByRole("button", { name: "Luo tili" }).click();
    await expect(page.getByText("Vahvista sähköposti", { exact: false })).toBeVisible();
    await page.getByRole("link", { name: "Vahvista sähköposti" }).click();

    // 2. Signed-in + verified: go to the demo decision via /decisions.
    await expect(page.getByRole("heading", { name: "Vahvistettu" })).toBeVisible();
    await page.goto("/decisions");
    await expect(page.getByText(/TEST — Esimerkkipäätös/)).toBeVisible();
    // Scope the Vaikuta chip to the demo decision row (avoids the header nav link).
    const demoRow = page.locator("li").filter({ hasText: /TEST — Esimerkkipäätös/ });
    await demoRow.getByRole("link", { name: "Vaikuta" }).click();

    // 3. Matter step → start the campaign.
    await expect(page.getByText("VAIHE 1 · ASIA")).toBeVisible();
    await page.getByRole("button", { name: /Vaikuta tähän päätökseen/ }).click();

    // 4. Recipients step — wait for the source-backed list, select two.
    await expect(page.getByText("VAIHE 2 · VASTAANOTTAJAT")).toBeVisible();
    await expect(page.locator("input[type=checkbox]").first()).toBeVisible({ timeout: 15000 });
    const boxes = page.locator("input[type=checkbox]");
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await expect(page.getByText(/Valittu/)).toBeVisible();
    await page.getByRole("button", { name: "Seuraava: viesti →" }).click();

    // 5. Message step — compose + one AI assist action + save.
    await expect(page.getByText("VAIHE 3 · VIESTI")).toBeVisible();
    await page.getByLabel("Otsikko").fill("Näkemykseni digi-infrastruktuurin rahoituksesta");
    const body =
      "Haluan, että julkisen digitaalisen infrastruktuurin rahoituksesta keskustellaan avoimesti ja läpinäkyvästi yhdessä kansalaisten kanssa. Tämä on e2e-testiviesti taskussa pidettynä neutraalina.";
    const bodyBox = page.getByLabel("Näkemyksesi");
    await bodyBox.fill(body);
    await page.getByRole("button", { name: "Selkeytä" }).click();
    // Position preserved after assist (never invented facts or arguments).
    await expect(page.getByLabel("Näkemyksesi")).toHaveValue(/Haluan, että julkisen/);
    await page.getByRole("button", { name: "Esikatselu →" }).click();

    // 6. Preview — user approves the final text.
    await expect(page.getByText("VAIHE 4 · ESIKATSELU")).toBeVisible();
    await expect(page.getByText(body.slice(0, 60))).toBeVisible();
    await page.getByRole("button", { name: /Hyväksyn lopullisen tekstin/ }).click();

    // 7. Checkout — launch the mock pay page.
    await expect(page.getByText("VAIHE 5 · KASSA")).toBeVisible();
    await page.getByRole("button", { name: "Siirry kassaan" }).click();
    await expect(page.getByText("Prototyyppikassa").first()).toBeVisible();
    await expect(page.getByText("14,90")).toBeVisible();

    // 8. Mock payment — confirm (no real charge).
    await page.getByRole("button", { name: "Vahvista maksusimulaatio" }).click();

    // 9. Confirmation.
    await expect(page.getByText("VALMIS", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Avaa kampanjahallinta" }).click();

    // 10. Dashboard — simulated delivery.
    await expect(page.getByText("Kampanjahallinta").or(page.getByText(/KAMPANJA/))).toBeVisible();
    await page.getByRole("button", { name: "Simuloi toimitus" }).click();
    await expect(page.getByText(/Toimitettu \(simuloitu\)/).first()).toBeVisible({ timeout: 15000 });

    expect(errors).toEqual([]);
  });

  test("no horizontal overflow on the wizard pages", async ({ page }) => {
    await page.goto("/vaikuta");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});