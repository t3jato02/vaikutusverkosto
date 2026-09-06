import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { baseUrl } from "@/lib/site";
import { isJournalistSubtype } from "@/lib/journalism";
import { slugifyName } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const entities = await db.entity.findMany({
    where: { type: { in: ["PERSON", "ORGANIZATION", "COMPANY", "GOVERNMENT_BODY", "POLITICAL_PARTY", "PUBLIC_AUTHORITY", "MEDIA_ORGANIZATION", "EDUCATIONAL_INSTITUTION", "PENSION_INSTITUTION", "ASSOCIATION", "FOUNDATION", "UNION", "COURT"] } },
    select: { id: true, canonicalName: true, type: true, subtype: true, updatedAt: true },
    take: 5000,
  });
  const prefix = (t: string, subtype?: string | null) =>
    t === "PERSON"
      ? subtype && isJournalistSubtype(subtype)
        ? "/toimittajat"
        : "/person"
      : t === "COMPANY"
        ? "/company"
        : t === "MEDIA_ORGANIZATION"
          ? "/media"
          : t === "POLITICAL_PARTY" || t === "GOVERNMENT_BODY" || t === "PUBLIC_AUTHORITY" || t === "EDUCATIONAL_INSTITUTION" || t === "COURT" || t === "PENSION_INSTITUTION"
            ? "/institution"
            : "/organization";
  const slug = (name: string) => slugifyName(name);

  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily" },
    { url: `${base}/explore`, lastModified: new Date(), changeFrequency: "weekly" },
    { url: `${base}/media`, lastModified: new Date(), changeFrequency: "weekly" },
    { url: `${base}/toimittajat`, lastModified: new Date(), changeFrequency: "weekly" },
    { url: `${base}/money`, lastModified: new Date(), changeFrequency: "weekly" },
    { url: `${base}/methodology`, lastModified: new Date(), changeFrequency: "monthly" },
    { url: `${base}/sources`, lastModified: new Date(), changeFrequency: "weekly" },
    ...entities.map((e) => ({
      url: `${base}${prefix(e.type, e.subtype)}/${slug(e.canonicalName)}-${e.id.slice(0, 8)}`,
      lastModified: e.updatedAt,
      changeFrequency: "weekly" as const,
    })),
  ];
}