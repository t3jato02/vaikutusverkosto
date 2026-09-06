import type { Prisma } from "@prisma/client";
import { entityUrlFor } from "@/lib/queries";
import { entityLabel } from "@/lib/constants";
import { sourceTypeLabel } from "@/components/SourceLink";
import { formatDate, formatDateLong } from "@/lib/format";
import type { RelRow } from "@/components/RelationshipList";

type RelWithGraph = Prisma.RelationshipGetPayload<{
  include: {
    sourceEntity: { select: { id: true; canonicalName: true; type: true; subtype: true } };
    targetEntity: { select: { id: true; canonicalName: true; type: true; subtype: true } };
    evidence: { include: { source: true } };
  };
}>;

/** Map DB relationships (with entities + evidence) to serializable rows for
 *  the RelationshipList client component, seen from `selfId`'s perspective. */
export function toRelRows(rels: RelWithGraph[], selfId: string): RelRow[] {
  return rels.map((r) => {
    const out = r.sourceEntityId === selfId;
    const other = out ? r.targetEntity : r.sourceEntity;
    const ev = r.evidence[0];
    const src = ev?.source;
    return {
      id: r.id,
      other: {
        id: other.id,
        name: other.canonicalName,
        href: entityUrlFor(other.id, other.type, other.canonicalName, other.subtype),
        typeLabel: entityLabel(other.type),
      },
      direction: out ? "out" : "in",
      relationshipType: r.relationshipType,
      role: r.role,
      startLabel: r.startDate ? formatDate(r.startDate) : null,
      endLabel: r.endDate ? formatDate(r.endDate) : null,
      temporalState: r.temporalState,
      verificationStatus: r.verificationStatus,
      evidence: src
        ? {
            quote: ev?.quotedFragment ?? null,
            sourceName: src.sourceName || src.sourceUrl,
            sourceUrl: src.sourceUrl,
            publisher: src.publisher ?? null,
            sourceTypeLabel: sourceTypeLabel(src.sourceType),
            documentTitle: src.documentTitle ?? ev?.documentTitle ?? null,
            publishedAt: src.publicationDate ? formatDateLong(src.publicationDate) : null,
            retrievedAt: src.retrievedAt ? formatDateLong(src.retrievedAt) : null,
          }
        : null,
    };
  });
}

/** Sort key: current before historical, then most recent start first. */
export function sortRelRows(rows: RelRow[]): RelRow[] {
  const rank = (s: RelRow["temporalState"]) => (s === "CURRENT" ? 0 : s === "UNKNOWN_PERIOD" ? 1 : 2);
  return [...rows].sort((a, b) => {
    const r = rank(a.temporalState) - rank(b.temporalState);
    if (r !== 0) return r;
    return (b.startLabel ?? "").localeCompare(a.startLabel ?? "");
  });
}
