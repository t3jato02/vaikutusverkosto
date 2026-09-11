// VAIKUTA pricing configuration — the single source of truth for plan
// definitions. Prices are integer minor units (1490 = €14.90). The UI renders
// ONLY from this config (and the mirrored VaikutaPlan table), never from
// hard-coded prices scattered around components. All authoritative entitlement
// decisions are made server-side from this config — the browser can never set
// a price or plan (see entitlements.ts).

export const PRICE_PASS_MINOR = 1490; // €14.90 per campaign (VAIKUTA PASS)
export const PRICE_PLUS_MINOR = 2490; // €24.90 / month (VAIKUTA PLUS)
export const PRICE_PRO_MINOR = 5900; // €59 / month (VAIKUTA PRO)
export const PRICE_ORG_MINOR = 19900; // starting €199 / month (ORGANIZATION)
export const CURRENCY_EUR = "EUR";

export type BillingPeriod = "one_time" | "monthly" | "yearly";

export interface PlanConfig {
  code: string;
  name: string;
  billingPeriod: BillingPeriod;
  priceMinor: number;
  currency: string;
  /** Per-campaign eligible-recipient cap. */
  recipientLimit: number;
  /** Campaign workflow allowance per billing period (null = unlimited). */
  campaignAllowance: number | null;
  aiAssist: boolean;
  monitoring: boolean;
  dedicated: boolean; // organization workspace / multiple users / approval workflow
  contactSales: boolean;
  tagline: string;
  features: string[];
  displayOrder: number;
}

export const PLANS: Record<string, PlanConfig> = {
  FREE: {
    code: "FREE",
    name: "FREE",
    billingPeriod: "one_time",
    priceMinor: 0,
    currency: CURRENCY_EUR,
    recipientLimit: 10, // limited recipient *preview only*, no campaign execution
    campaignAllowance: 0, // free users cannot execute paid campaigns
    aiAssist: true,
    monitoring: false,
    dedicated: false,
    contactSales: false,
    tagline: "Tutki verkostoja ja päätöksiä ilmaiseksi",
    displayOrder: 0,
    features: [
      "Koko verkoston julkinen selaus",
      "Päätökset ja lähdeperustainen tiedotus",
      "Rajoitettu vastaanottajaesikatselu",
      "Viestiluonnos",
      "Ei kampanjan suorittamista",
    ],
  },
  VAIKUTA_PASS: {
    code: "VAIKUTA_PASS",
    name: "VAIKUTA PASS",
    billingPeriod: "one_time",
    priceMinor: PRICE_PASS_MINOR,
    currency: CURRENCY_EUR,
    recipientLimit: 20,
    campaignAllowance: 1,
    aiAssist: true,
    monitoring: false,
    dedicated: false,
    contactSales: false,
    tagline: "Satunnaiseen kansalaisosallistumiseen",
    displayOrder: 1,
    features: [
      "Yksi päätös per kampanja",
      "Relevantit vastaanottajat (korkeintaan 20)",
      "AI-avustaja viestin muokkaamiseen",
      "Tosiasiaviitteiden lisääjä",
      "Kampanjakohtainen hallintanäkymä",
      "Vastausseurannan valmius",
    ],
  },
  VAIKUTA_PLUS: {
    code: "VAIKUTA_PLUS",
    name: "VAIKUTA PLUS",
    billingPeriod: "monthly",
    priceMinor: PRICE_PLUS_MINOR,
    currency: CURRENCY_EUR,
    recipientLimit: 50,
    campaignAllowance: 5,
    aiAssist: true,
    monitoring: true,
    dedicated: false,
    contactSales: false,
    tagline: "Aktiiviselle kansalaisosallistujalle",
    displayOrder: 2,
    features: [
      "Enintään 5 aktiivista kampanjaa / kk",
      "Laajemmat vastaanottajatiedot",
      "Tallennetut kampanjat",
      "Päätösseuranta ja hälytykset",
      "AI-luonnos ja -muokkaus",
      "Kampanjahistoria ja vastausnäkymä",
    ],
  },
  VAIKUTA_PRO: {
    code: "VAIKUTA_PRO",
    name: "VAIKUTA PRO",
    billingPeriod: "monthly",
    priceMinor: PRICE_PRO_MINOR,
    currency: CURRENCY_EUR,
    recipientLimit: 200,
    campaignAllowance: 20,
    aiAssist: true,
    monitoring: true,
    dedicated: false,
    contactSales: false,
    tagline: "Ammattimaisesti aktiiviselle käyttäjälle ja tutkijalle",
    displayOrder: 3,
    features: [
      "Enintään 20 kampanjaa / kk",
      "Laaja verkostokonteksti",
      "Kehittynyt päätösseuranta",
      "Vertailevat työkalut",
      "Vientimahdollisuudet lainsäädännön sallimissa rajoissa",
      "Tehostettu analytiikka ja priorisointi",
    ],
  },
  ORGANIZATION: {
    code: "ORGANIZATION",
    name: "ORGANIZATION",
    billingPeriod: "monthly",
    priceMinor: PRICE_ORG_MINOR,
    currency: CURRENCY_EUR,
    recipientLimit: 500,
    campaignAllowance: 50,
    aiAssist: true,
    monitoring: true,
    dedicated: true,
    contactSales: true,
    tagline: "Yhdistyksille, järjestöille ja organisaatioille",
    displayOrder: 4,
    features: [
      "Organisaatiotila ja useita käyttäjiä",
      "Hyväksyntätyönkulku",
      "Jaettu tutkimusympäristö",
      "Organisaatioidentiteetti",
      "Kehittynyt raportointi",
      "Läpinäkyvyys- ja audit aura",
    ],
  },
};

export function planConfig(code: string): PlanConfig {
  return PLANS[code] ?? PLANS.FREE;
}

export function pricingVersion(): string {
  return `v1-${PLANS.FREE.priceMinor}-${PLANS.VAIKUTA_PASS.priceMinor}-${PLANS.VAIKUTA_PLUS.priceMinor}-${PLANS.VAIKUTA_PRO.priceMinor}-${PLANS.ORGANIZATION.priceMinor}`;
}

/** Plans in display order (FREE first, then by price). */
export function activePlans(): PlanConfig[] {
  return Object.values(PLANS).sort((a, b) => a.displayOrder - b.displayOrder);
}

export const VAIKUTA_PRECISE_LABEL =
  "Vaikuta ei ole massasähköpostipalvelu. Maksujen vastine on vastaanottajien etsintä, " +
  "päätöskartta, lähdepohjainen relevanssi, AI-avustaja, seuranta ja kampanjan organisointi.";