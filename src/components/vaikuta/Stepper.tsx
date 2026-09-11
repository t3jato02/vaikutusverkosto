// Wizard step indicator. Steps are data/show-only states; the current step is
// always derived from campaign state, never inferred from the URL alone.

const STEPS = [
  { key: "matter", label: "Asia" },
  { key: "recipients", label: "Vastaanottajat" },
  { key: "message", label: "Viesti" },
  { key: "preview", label: "Esikatselu" },
  { key: "checkout", label: "Kassa" },
  { key: "confirmation", label: "Vahvistus" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export function stepIndex(key: StepKey): number {
  return STEPS.findIndex((s) => s.key === key);
}

export function Stepper({ current }: { current: StepKey }) {
  const currentIdx = stepIndex(current);
  return (
    <nav aria-label="Kampanjan vaiheet" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1">
        {STEPS.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <li key={s.key} className="flex items-center gap-1">
              {i > 0 && <span className="mx-1 h-px w-3 bg-line" aria-hidden />}
              <span
                aria-current={active ? "step" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium ${
                  active
                    ? "border-accent bg-accent-soft text-accent-dark"
                    : done
                      ? "border-line bg-ink-100 text-ink-700"
                      : "border-line bg-surface text-ink-300"
                }`}
              >
                <span className="tabular-nums">{i + 1}</span>
                <span className={active ? "inline" : done ? "inline" : "hidden sm:inline"}>{s.label}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}