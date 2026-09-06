// "Verkostoasema" — a small, score-free summary of where an entity sits in the
// documented network (Sprint C4 Phase 15).
//
// Only understandable facts: how many documented connections, how much
// documented funding, how many distinct funders / funder countries / projects.
// There is NO single score and NO betweenness computed per request (Phase 26).
// A high number here is not a finding of wrongdoing — it is just reach.

import Link from "next/link";
import { RelationshipType } from "@prisma/client";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/format";
import { entityFundingMetrics } from "@/lib/analytics";
import { publicVisibleWhere } from "@/lib/verification";

const ORG_RELS: RelationshipType[] = [
  "MEMBER_OF", "FORMER_MEMBER_OF", "BOARD_MEMBER_OF", "CHAIRS", "EMPLOYED_BY",
  "APPOINTED_BY", "APPOINTED_TO", "ADVISER_TO", "SITS_IN", "PART_OF", "REPRESENTS",
];
const OWN_RELS: RelationshipType[] = ["OWNS", "BENEFICIAL_OWNER_OF", "SHAREHOLDER_OF", "INVESTED_IN"];

export default async function EntityNetworkPosition({ entityId }: { entityId: string }) {
  const relWhere = (types: RelationshipType[]) => ({
    ...publicVisibleWhere,
    relationshipType: { in: types },
    OR: [{ sourceEntityId: entityId }, { targetEntityId: entityId }],
  });

  const [funding, orgTotal, orgCurrent, ownTotal] = await Promise.all([
    entityFundingMetrics(entityId),
    db.relationship.count({ where: relWhere(ORG_RELS) }),
    db.relationship.count({ where: { ...relWhere(ORG_RELS), temporalState: "CURRENT" as const } }),
    db.relationship.count({ where: relWhere(OWN_RELS) }),
  ]);

  const facts: { label: string; value: string; hint?: string }[] = [];
  if (orgTotal > 0) {
    facts.push({
      label: "Yhteyksien määrä organisaatioverkostossa",
      value: orgCurrent === orgTotal ? `${orgTotal}` : `${orgCurrent} nykyistä · ${orgTotal} kaikkiaan`,
      hint: "Jäsenyydet, hallituspaikat, työsuhteet ja nimitykset, joilla on lähde.",
    });
  }
  if (ownTotal > 0) {
    facts.push({
      label: "Omistus- ja osakkuusyhteyksiä",
      value: `${ownTotal}`,
      hint: "Dokumentoidut omistus-, osakkuus- ja sijoitussuhteet.",
    });
  }
  if (funding.incomingRecords > 0) {
    facts.push({
      label: "Dokumentoitua rahoitusta sisään",
      value: `${formatEur(funding.incomingDocumentedEur)} · ${funding.incomingRecords} erää`,
      hint: `${funding.uniqueFunders} eri rahoittajaa${funding.uniqueFunderCountries > 0 ? ` · ${funding.uniqueFunderCountries} maata` : ""}${funding.projects > 0 ? ` · ${funding.projects} hanketta` : ""}.`,
    });
  }
  if (funding.outgoingRecords > 0) {
    facts.push({
      label: "Dokumentoitua rahoitusta ulos",
      value: `${formatEur(funding.outgoingDocumentedEur)} · ${funding.outgoingRecords} erää`,
    });
  }

  if (facts.length === 0) return null;

  return (
    <section aria-label="Verkostoasema">
      <h2 className="section-title mb-1">Verkostoasema</h2>
      <p className="mb-2 text-[11px] text-muted">
        Ymmärrettäviä tunnuslukuja siitä, miten laajasti toimija on kytkeytynyt dokumentoituun
        verkostoon. Ei yhtä lukua eikä &quot;vaikuttamis-scorea&quot;. Suuri luku tarkoittaa laajaa
        kytkeytyneisyyttä — ei väärinkäytöstä, korruptiota tai epäasiallista vaikuttamista.{" "}
        <Link href="/analytics" className="text-accent hover:underline">Verkostoanalyysi</Link>.
      </p>
      <dl className="card divide-y divide-line">
        {facts.map((f) => (
          <div key={f.label} className="py-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <dt className="text-sm text-ink-600">{f.label}</dt>
              <dd className="shrink-0 text-sm font-semibold tabular-nums">{f.value}</dd>
            </div>
            {f.hint && <p className="mt-0.5 text-[11px] text-ink-400">{f.hint}</p>}
          </div>
        ))}
      </dl>
    </section>
  );
}
