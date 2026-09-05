import { CONFIDENCE_LABELS } from "@/lib/constants";
import type { Confidence, VerificationStatus } from "@prisma/client";

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  VERIFIED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  HIGH: "bg-sky-50 text-sky-800 border-sky-200",
  MEDIUM: "bg-amber-50 text-amber-800 border-amber-200",
  LOW: "bg-orange-50 text-orange-800 border-orange-200",
  DISPUTED: "bg-red-50 text-red-800 border-red-200",
};

export function ConfidenceBadge({ value, lang = "fi" }: { value: Confidence; lang?: "fi" | "en" }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${CONFIDENCE_STYLES[value]}`}
    >
      {CONFIDENCE_LABELS[value]?.[lang]}
    </span>
  );
}

// Fact-type separation (section 44): FACT / DERIVED / INFERENCE / ALLEGATION / DISPUTED.
export type FactKind = "FACT" | "DERIVED" | "INFERENCE" | "ALLEGATION" | "DISPUTED";

const FACT_STYLES: Record<FactKind, { label: string; cls: string; title: string }> = {
  FACT: {
    label: "TOSI",
    cls: "bg-ink-900 text-white border-ink-900",
    title: "Dokumentoitu tosiasia, joka perustuu lähteeseen",
  },
  DERIVED: {
    label: "JOHDETTU",
    cls: "bg-accent/10 text-accent border-accent/40",
    title: "Laskennallinen mittari (ei suora väite tosiasiasta)",
  },
  INFERENCE: {
    label: "PÄÄTELMÄ",
    cls: "bg-purple-50 text-purple-800 border-purple-200",
    title: "Analyyttinen päättely, ei varmennettu tosiasia",
  },
  ALLEGATION: {
    label: "VÄITE",
    cls: "bg-red-50 text-red-800 border-red-200",
    title: "Väite tai syytös, jonka lähde esittää — ei vahvistettu",
  },
  DISPUTED: {
    label: "RIITAUTETTU",
    cls: "bg-orange-50 text-orange-800 border-orange-200",
    title: "Lähteet ovat ristiriidassa keskenään",
  },
};

export function FactBadge({ kind }: { kind: FactKind }) {
  const s = FACT_STYLES[kind];
  return (
    <span
      title={s.title}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

// A7 verification status. SOURCE_CONFIRMED / HUMAN_VERIFIED render as a plain
// FACT badge upstream; this badge exists to make DISPUTED and STALE unmissable.
const STATUS_STYLES: Partial<Record<VerificationStatus, { label: string; cls: string; title: string }>> = {
  HUMAN_VERIFIED: {
    label: "IHMISEN VARMISTAMA",
    cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
    title: "Tarkastaja on tarkistanut lähteen ja hyväksynyt yhteyden",
  },
  DISPUTED: {
    label: "RIITAUTETTU",
    cls: "bg-orange-50 text-orange-800 border-orange-200",
    title: "Yhteydestä on uskottava ristiriita tai korjauspyyntö",
  },
  STALE: {
    label: "VANHENTUNUT",
    cls: "bg-amber-50 text-amber-800 border-amber-200",
    title: "Tieto oli aiemmin pätevä; nykytila on todennäköisesti muuttunut",
  },
  AUTO_DETECTED: {
    label: "EI VARMISTETTU",
    cls: "bg-ink-100 text-ink-500 border-ink-300",
    title: "Agentti havaitsi yhteyden; lähdettä ei ole vielä riittävästi varmistettu",
  },
};

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  const s = STATUS_STYLES[status];
  if (!s) return null;
  return (
    <span
      title={s.title}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span
      title="Tämä tieto on demodataa, ei tuotantotietoa"
      className="inline-flex items-center rounded border border-dashed border-ink-300 bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink-500"
    >
      DEMO
    </span>
  );
}