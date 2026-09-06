import type { EvidenceGrade } from "@prisma/client";
import { EVIDENCE_GRADE_LABELS } from "@/lib/journalism";

const GRADE_CLASS: Record<EvidenceGrade, string> = {
  A: "bg-verified-soft text-verified border-verified/25",
  B: "bg-accent-soft text-accent-dark border-accent/25",
  C: "bg-stale-soft text-stale border-stale/25",
  D: "bg-ink-100 text-ink-500 border-line",
  E: "bg-disputed-soft text-disputed border-disputed/25",
};

/**
 * Evidence grade badge (section 9). A = primary, … E = unverified (never shown
 * as fact). Tooltip explains what the grade means.
 */
export function EvidenceGradeBadge({ grade, size = "sm" }: { grade: EvidenceGrade; size?: "sm" | "xs" }) {
  const meta = EVIDENCE_GRADE_LABELS[grade];
  return (
    <span
      title={`${meta.fi}: ${meta.description}`}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-semibold ${GRADE_CLASS[grade]} ${
        size === "xs" ? "text-[10px]" : "text-[11px]"
      }`}
    >
      Lähde {grade}
    </span>
  );
}