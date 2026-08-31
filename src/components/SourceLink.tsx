import type { SourceType } from "@prisma/client";
import { formatDateLong } from "@/lib/format";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  OFFICIAL_PRIMARY: "VIRALLINEN ENSISIJAINEN LÄHDE",
  OFFICIAL_REGISTER: "VIRALLINEN REKISTERI",
  COURT_DOCUMENT: "JULKINEN ASIAKIRJA",
  PARLIAMENTARY_RECORD: "VALTIOPÄIVÄASIAKIRJA",
  COMPANY_DISCLOSURE: "YHTIÖN JULKISTUS",
  ANNUAL_REPORT: "VUOSIKERTOMUS",
  PROCUREMENT_RECORD: "HANKINTA-ASIAKIRJA",
  ORGANIZATION_DISCLOSURE: "ORGANISAATION JULKISTUS",
  ACADEMIC_SOURCE: "TIETEELLINEN LÄHDE",
  REPUTABLE_MEDIA: "MEDIA",
  SECONDARY_MEDIA: "MEDIA (TOISSIJAINEN)",
  OTHER: "MUU LÄHDE",
};

export function sourceTypeLabel(t: SourceType | string): string {
  return SOURCE_TYPE_LABELS[t] ?? String(t);
}

export default function SourceLink({
  url,
  name,
  publisher,
  sourceType,
  retrievedAt,
}: {
  url: string;
  name: string;
  publisher?: string | null;
  sourceType: SourceType | string;
  retrievedAt?: Date | null;
}) {
  return (
    <div className="rounded border border-ink-100 bg-ink-100/40 px-2 py-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <a href={url} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
          {name || url}
        </a>
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">
          {sourceTypeLabel(sourceType)}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-500">
        {publisher && <span>Julkaisija: {publisher}</span>}
        {retrievedAt && <span>Noudettu: {formatDateLong(retrievedAt)}</span>}
        <span>Näytä lähde →</span>
      </div>
    </div>
  );
}