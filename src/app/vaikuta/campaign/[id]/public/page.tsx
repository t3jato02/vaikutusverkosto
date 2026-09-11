import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Julkinen kampanja" };
export const dynamic = "force-dynamic";

// Public campaign page. Only renders for campaigns explicitly published by the
// owner (VAIKUTA_PUBLIC_CAMPAIGNS must be enabled). It NEVER shows the private
// message or sender correspondence — only the user-provided public statement.
export default async function PublicCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await db.influenceCampaign.findUnique({
    where: { id },
    include: {
      decision: {
        include: {
          institutionEntity: { select: { canonicalName: true } },
          source: true,
        },
      },
      _count: { select: { recipients: true } },
    },
  });
  if (!campaign || campaign.publicVisibility !== "PUBLIC" || !campaign.publicStatement) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="label">JULKINEN KAMPANJA</p>
        <h1 className="mt-1 text-entity-title">{campaign.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {campaign.decision.institutionEntity?.canonicalName ?? "—"} · päätös:{" "}
          <Link href={`/decision/${campaign.decisionId}`} className="text-accent hover:underline">
            {campaign.decision.title}
          </Link>
        </p>
      </header>

      <section className="card space-y-2" aria-label="Julkinen kannanotto">
        <h2 className="card-title">OSALLISTUJAN JULKINEN KANNANOTTO</h2>
        <p className="text-[14px] leading-relaxed text-ink-700">{campaign.publicStatement}</p>
      </section>

      <section className="card space-y-2" aria-label="Yhteenveto">
        <h2 className="card-title">YHTEENVETO</h2>
        <dl className="space-y-1 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-ink-500">Osallistujia</dt>
            <dd className="font-medium tabular-nums">1</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Relevantteja vastaanottajia</dt>
            <dd className="font-medium tabular-nums">{campaign._count.recipients}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Päätöksen tila</dt>
            <dd>{campaign.decision.source ? "Käsittelyssä (dokumentoitu lähteenä)" : "Ei vahvistettua tila"}</dd>
          </div>
        </dl>
      </section>

      <section className="card space-y-2" aria-label="Lähteet">
        <h2 className="card-title">LÄHTEET</h2>
        {campaign.decision.source ? (
          <a href={campaign.decision.source.sourceUrl} target="_blank" rel="noreferrer" className="text-[13px] text-accent hover:underline">
            {campaign.decision.source.sourceName}
          </a>
        ) : (
          <p className="text-[13px] text-ink-500">Ei erillistä lähdettä.</p>
        )}
      </section>

      <p className="text-[12px] text-ink-500">
        Vastaanottajien nimet ja yksityinen viestisisältö eivät sisälly julkiseen sivustoon.
      </p>
    </div>
  );
}