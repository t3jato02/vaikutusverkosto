import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatDateLong } from "@/lib/format";

export const metadata: Metadata = { title: "Todisteet" };
export const dynamic = "force-dynamic";

export default async function AdminEvidencePage() {
  const evidence = await db.evidence.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      source: { select: { sourceUrl: true, sourceName: true, publisher: true, sourceType: true, status: true } },
      relationship: { select: { id: true, relationshipType: true, sourceEntity: { select: { id: true, canonicalName: true, type: true } }, targetEntity: { select: { id: true, canonicalName: true, type: true } } } },
    },
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Todisteet</h1>
        <Link href="/admin" className="btn text-xs">Takaisin</Link>
      </div>
      <ul className="card divide-y divide-ink-100">
        {evidence.map((ev) => (
          <li key={ev.id} className="py-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-ink-900">
                {ev.relationship?.sourceEntity.canonicalName ?? "—"} → {ev.relationship?.targetEntity.canonicalName ?? "—"}
              </span>
              <span className="text-ink-500">{ev.relationship?.relationshipType ?? "—"}</span>
            </div>
            <a href={ev.source.sourceUrl} target="_blank" rel="noreferrer" className="block truncate text-accent hover:underline">
              {ev.source.sourceName} — {ev.source.sourceUrl}
            </a>
            <div className="text-ink-400">
              {ev.source.publisher} · {ev.source.sourceType} · {ev.source.status} · {formatDateLong(ev.createdAt)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}