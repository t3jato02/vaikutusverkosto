import type { Metadata } from "next";
import type { EntityType } from "@prisma/client";
import Link from "next/link";
import { db } from "@/lib/db";
import { benefitEventTypeLabel, valuePrecisionLabel, selectionRoleLabel } from "@/lib/benefits";
import { entityUrlFor } from "@/lib/queries";
import { formatEur, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Lahjat & palkinnot — tarkistus" };
export const dynamic = "force-dynamic";

export default async function AdminBenefitsPage() {
  const [pending, published] = await Promise.all([
    db.benefitEvent.findMany({
      where: { reviewStatus: "PENDING_REVIEW" },
      include: {
        recipientEntity: { select: { id: true, canonicalName: true, type: true } },
        giverEntity: { select: { id: true, canonicalName: true, type: true } },
        payerEntity: { select: { id: true, canonicalName: true, type: true } },
        source: { select: { sourceUrl: true, sourceName: true, sourceType: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    db.benefitEvent.count({ where: { reviewStatus: "PUBLISHED" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Lahjat, palkinnot ja edut — tarkistusjono</h1>
        <span className="text-xs text-ink-500">
          {pending.length} odottaa · {published} julkaistua
        </span>
      </div>
      <Link href="/admin" className="text-xs text-accent hover:underline">← Hallinta</Link>

      {pending.length === 0 && (
        <p className="rounded-lg border border-line bg-surface px-4 py-6 text-sm text-ink-500">
          Ei uusia ehdokkaita. Lahja-, etu- ja palkintotapahtumia lisätään vain lähdeperustaisesti;
          arvioita ei esitetä tarkkoina summina eikä julkaista ilman tarkistusta.
        </p>
      )}

      {pending.map((b) => {
        const partyRows = [b.giverEntity, b.recipientEntity, b.payerEntity].filter((p) => p !== null) as { id: string; canonicalName: string; type: string }[];
        return (
          <div key={b.id} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[11px] uppercase tracking-wide text-ink-500">{benefitEventTypeLabel(b.eventType)}</span>
                <h2 className="text-sm font-semibold">{b.title}</h2>
                {b.description && <p className="text-xs text-ink-500">{b.description}</p>}
              </div>
              <div className="flex flex-col items-end text-xs text-ink-500">
                {b.eventDate && <span>{formatDate(b.eventDate)}</span>}
                {b.monetaryValue !== null && (
                  <span className="tabular-nums">{formatEur(b.monetaryValue)} {b.currency} · {valuePrecisionLabel(b.valueType)}</span>
                )}
                {b.selectionRole && <span>{selectionRoleLabel(b.selectionRole)}</span>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
              {partyRows.map((p) => (
                <Link key={p.id} href={entityUrlFor(p.id, p.type as EntityType, p.canonicalName)} className="rounded bg-ink-100 px-2 py-0.5 text-accent hover:underline">
                  {p.canonicalName}
                </Link>
              ))}
              {!partyRows.length && <span className="text-[12px] text-ink-500">Ei tarkennettuja osapuolia</span>}
            </div>
            <div className="mt-1.5 text-[11px] text-ink-500">
              Näyttöaste: {b.evidenceGrade} · {b.confidence} · luotu {formatDate(b.createdAt)} · luoja {b.createdBy ?? "—"}
              {b.source && (
                <a href={b.source.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline"> · lähde: {b.source.sourceName} ↗</a>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <form action="/api/admin/review" method="post" className="inline">
                <input type="hidden" name="target" value="benefit" />
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="action" value="approve" />
                <button type="submit" className="btn btn-primary">Hyväksy</button>
              </form>
              <form action="/api/admin/review" method="post" className="inline">
                <input type="hidden" name="target" value="benefit" />
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="action" value="reject" />
                <button type="submit" className="btn">Hylkää</button>
              </form>
              <form action="/api/admin/review" method="post" className="inline">
                <input type="hidden" name="target" value="benefit" />
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="action" value="dispute" />
                <button type="submit" className="btn">Riitauta</button>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}