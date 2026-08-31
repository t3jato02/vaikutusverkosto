import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.PUBLIC_BASE_URL ?? "https://vaikutusverkosto.example";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/admin", "/api/cron", "/login"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}