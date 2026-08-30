import type { Prisma } from "@prisma/client";

export type Money = number | string | Prisma.Decimal | null | undefined;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "entity";
}

export function entitySlug(id: string, name: string): string {
  return `${slugify(name)}-${id.slice(0, 8)}`;
}

export function parseSlug(slug: string): string | null {
  const match = slug.match(/-([0-9a-f]{8})$/);
  return match ? match[1] : null;
}

export function findEntityIdFromSlug(slug: string): string {
  const short = parseSlug(slug);
  if (!short) return slug;
  // Prefix search is handled in the query layer.
  return short;
}

export function formatEur(value: Money, decimals = 0): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "object" && "toNumber" in value ? (value as Prisma.Decimal).toNumber() : Number(value);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fi-FI", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fi-FI").format(value);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fi-FI", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function formatDateLong(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fi-FI", { year: "numeric", month: "long", day: "numeric" }).format(d);
}

export function relativeTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "tänään";
  if (days === 1) return "eilen";
  if (days < 30) return `${days} päivää sitten`;
  if (days < 365) return `${Math.floor(days / 30)} kk sitten`;
  return `${Math.floor(days / 365)} v sitten`;
}

export function yearOf(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return d.getFullYear();
}

export function parseFinnishDate(ddmmyyyy?: string | null): Date | null {
  if (!ddmmyyyy || !/^\d{2}\.\d{2}\.\d{4}$/.test(ddmmyyyy)) return null;
  const [d, m, y] = ddmmyyyy.split(".").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}