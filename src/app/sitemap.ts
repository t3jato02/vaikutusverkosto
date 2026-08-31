import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.PUBLIC_BASE_URL ?? "https://vaikutusverkosto.example";
  const entities = await db.entity.findMany({
    where: { type: { in: ["PERSON", "ORGANIZATION", "COMPANY", "GOVERNMENT_BODY", "POLITICAL_PARTY", "PUBLIC_AUTHORITY", "MEDIA_ORGANIZATION", "EDUCATIONAL_INSTITUTION", "PENSION_INSTITUTION", "ASSOCIATION", "FOUNDATION", "UNION", "COURT"] } },
    select: { id: true, canonicalName: true, type: true, updatedAt: true },
    take: 5000,
  });
  const prefix = (t: string) =>
    t === "PERSON"
      ? "/person"
      : t === "COMPANY"
        ? "/company"
        : t === "POLITICAL_PARTY" || t === "GOVERNMENT_BODY" || t === "PUBLIC_AUTHORITY" || t === "MEDIA_ORGANIZATION" || t === "EDUCATIONAL_INSTITUTION" || t === "COURT" || t === "PENSION_INSTITUTION"
          ? "/institution"
          : "/organization";
  const slug = (name: string) =>
    name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ä/g, "a").replace(/ö/g, "o").replace(/å/g, "a").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "entity";

  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily" },
    { url: `${base}/explore`, lastModified: new Date(), changeFrequency: "weekly" },
    { url: `${base}/money`, lastModified: new Date(), changeFrequency: "weekly" },
    { url: `${base}/methodology`, lastModified: new Date(), changeFrequency: "monthly" },
    { url: `${base}/sources`, lastModified: new Date(), changeFrequency: "weekly" },
    ...entities.map((e) => ({
      url: `${base}${prefix(e.type)}/${slug(e.canonicalName)}-${e.id.slice(0, 8)}`,
      lastModified: e.updatedAt,
      changeFrequency: "weekly" as const,
    })),
  ];
}