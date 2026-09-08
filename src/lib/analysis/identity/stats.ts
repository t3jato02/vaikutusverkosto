// Small, dependency-free statistics helpers for the identity-framing analyses
// (luvut 4, 12). Only proportions and their Wilson intervals are used — the
// system never overstates precision and always reports sample sizes.

/** Wilson score interval (95%) for a binomial proportion. */
export function wilsonInterval(successes: number, n: number): { p: number; low: number; high: number } {
  if (n <= 0) return { p: 0, low: 0, high: 0 };
  const z = 1.96;
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const halfWidth = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return { p, low: Math.max(0, centre - halfWidth), high: Math.min(1, centre + halfWidth) };
}

/** Cohen's h for the difference of two proportions. */
export function cohensH(p1: number, p2: number): number {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const f = (p: number) => 2 * Math.asin(Math.sqrt(clamp(p)));
  return f(clamp(p1)) - f(clamp(p2));
}

/** Approximate standard error of Cohen's h (Wald-based). */
export function cohensHSigma(n1: number, n2: number): number {
  return Math.sqrt(1 / Math.max(1, n1) + 1 / Math.max(1, n2));
}

export function formatPct(x: number | null | undefined): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(1)} %`;
}

export interface ProportionReport {
  successes: number;
  n: number;
  p: number;
  low: number;
  high: number;
}

export function proportionReport(successes: number, n: number): ProportionReport {
  const w = wilsonInterval(successes, n);
  return { successes, n, p: w.p, low: w.low, high: w.high };
}

/** Years a person was a given age on a reference date (null when unknown). */
export function ageIn(birthYear: number | null, referenceYear: number): number | null {
  if (!birthYear) return null;
  return Math.max(0, referenceYear - birthYear);
}

/** Decade bucket used for coarse age matching. */
export function ageBucket(birthYear: number | null): number | null {
  if (!birthYear) return null;
  return Math.floor(birthYear / 10) * 10;
}