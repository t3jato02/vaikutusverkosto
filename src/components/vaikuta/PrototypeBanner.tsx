// Prototype banner — the module clearly communicates that no real charge and
// no real message delivery is performed. This component is used on every
// page where money or delivery is shown.

export function PrototypeBanner({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      role="note"
      className={`card border-amber-200 bg-amber-50 text-amber-900 ${compact ? "py-2.5" : ""}`}
    >
      <p className="text-[13px] leading-snug">
        <strong>Prototyyppitila.</strong>{" "}
        {compact ? (
          <>Maksua ei veloiteta eikä viestejä lähetetä ulkopuolisille.</>
        ) : (
          <>
            Mikään tässä vaiheessa ei veloita maksuja eikä lähetä viestejä ulkopuolisille. Kassa-,
            maksu- ja toimitusnäkymät ovat simulointia, jotta käyttäjä näkee tuotteen todellisen
            käytön ennen kuin nämä otetaan käyttöön.
          </>
        )}
      </p>
    </aside>
  );
}

export function SimulatedTag({ label = "Simuloitu" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
      <span className="status-dot bg-warning" aria-hidden />
      {label}
    </span>
  );
}