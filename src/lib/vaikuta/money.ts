// Money helpers for the VAIKUTA module.
// All monetary values are stored as integer minor units (cents):
//   1490 = €14.90. Floating point is NEVER used for money.

export function eurToMinor(eur: number): number {
  return Math.round(eur * 100);
}

export function minorToEur(minor: number): number {
  return minor / 100;
}

/** "14,90 €" from 1490 — finance-safe formatting straight from minor units. */
export function formatMinor(minor: number, currency = "EUR"): string {
  if (currency !== "EUR") return `${minorToEur(minor).toFixed(2)} ${currency}`;
  return new Intl.NumberFormat("fi-FI", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/**
 * Sanitize a money value received from the browser: only a non-negative
 * integer within reason is accepted; anything suspicious → null. The server
 * never *trusts* this — it is used only to *validate* the shape of input
 * before the authoritative price is re-derived from pricing config.
 */
export function sanitizeMinor(raw: unknown): number | null {
  if (typeof raw !== "number") return null;
  if (!Number.isFinite(raw)) return null;
  if (!Number.isInteger(raw)) return null;
  if (raw < 0 || raw > 10_000_000_000) return null;
  return raw;
}