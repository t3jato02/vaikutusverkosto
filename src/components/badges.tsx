import type { Confidence, VerificationStatus, TemporalState } from "@prisma/client";
import { verificationLabel, temporalLabel, confidenceLabel, type VerificationTone } from "@/lib/labels";

const TONE_CLASS: Record<VerificationTone, string> = {
  confirmed: "bg-verified-soft text-verified border-verified/25",
  review: "bg-ink-100 text-ink-700 border-line",
  disputed: "bg-disputed-soft text-disputed border-disputed/25",
  stale: "bg-stale-soft text-stale border-stale/25",
  rejected: "bg-ink-100 text-ink-500 border-line",
};

const TONE_DOT: Record<VerificationTone, string> = {
  confirmed: "bg-verified",
  review: "bg-ink-300",
  disputed: "bg-disputed",
  stale: "bg-stale",
  rejected: "bg-ink-300",
};

/**
 * Human-readable verification status. No raw enum, no "TOSI".
 * `variant="dot"` renders a compact dot + label for dense lists.
 */
export function VerificationBadge({
  status,
  variant = "chip",
  lang = "fi",
}: {
  status: VerificationStatus;
  variant?: "chip" | "dot";
  lang?: "fi" | "en";
}) {
  const v = verificationLabel(status, lang);
  if (variant === "dot") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-muted" title={v.description}>
        <span className={`status-dot ${TONE_DOT[v.tone]}`} aria-hidden />
        {v.label}
      </span>
    );
  }
  return (
    <span
      title={v.description}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ${TONE_CLASS[v.tone]}`}
    >
      <span className={`status-dot ${TONE_DOT[v.tone]}`} aria-hidden />
      {v.label}
    </span>
  );
}

const CONFIDENCE_CLASS: Record<Confidence, string> = {
  VERIFIED: "bg-verified-soft text-verified border-verified/25",
  HIGH: "bg-accent-soft text-accent-dark border-accent/25",
  MEDIUM: "bg-stale-soft text-stale border-stale/25",
  LOW: "bg-ink-100 text-ink-500 border-line",
  DISPUTED: "bg-disputed-soft text-disputed border-disputed/25",
};

export function ConfidenceBadge({ value, lang = "fi" }: { value: Confidence; lang?: "fi" | "en" }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${CONFIDENCE_CLASS[value]}`}
    >
      {confidenceLabel(value, lang)}
    </span>
  );
}

/** Current vs historical vs unknown period — meaning, not decoration. */
export function TemporalBadge({ state, lang = "fi" }: { state: TemporalState; lang?: "fi" | "en" }) {
  if (state === "CURRENT") return null; // "current" is the norm; only flag the exceptions
  const cls =
    state === "HISTORICAL"
      ? "bg-ink-100 text-ink-500 border-line"
      : "bg-stale-soft text-stale border-stale/25";
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {temporalLabel(state, lang)}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span
      title="Tämä tieto on demodataa, ei tuotantotietoa"
      className="inline-flex items-center rounded border border-dashed border-ink-300 bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink-500"
    >
      DEMODATA
    </span>
  );
}
