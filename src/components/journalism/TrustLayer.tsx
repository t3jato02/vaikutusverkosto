// Luottamuskerros (section 33) — kolmen symbolin järjestelmä, jolla käyttäjä
// näkee yhdellä silmäyksellä, onko tieto vahvistettu lähteellä, laskettu
// analyysi vai epävarma.

export function TrustChip({ kind }: { kind: "verified" | "analysis" | "uncertain" }) {
  const cfg = {
    verified: { symbol: "✓", label: "Vahvistettu lähteellä", cls: "text-verified" },
    analysis: { symbol: "◐", label: "Automaattinen analyysi", cls: "text-stale" },
    uncertain: { symbol: "?", label: "Epävarma / puutteellinen", cls: "text-muted" },
  }[kind];
  return (
    <span className="inline-flex items-center gap-1 text-[11px]">
      <span className={`font-bold ${cfg.cls}`} aria-hidden>
        {cfg.symbol}
      </span>
      <span>{cfg.label}</span>
    </span>
  );
}

export function TrustLegend({ id }: { id?: string }) {
  return (
    <div id={id} className="rounded-lg border border-line bg-surface px-4 py-3 text-[12px] leading-relaxed text-muted">
      <dl className="grid gap-1 sm:grid-cols-3">
        <div className="flex items-start gap-1.5">
          <dd className="sr-only">Vahvistettu</dd>
          <TrustChip kind="verified" />
          <span className="text-[11px] text-ink-300">— lähde osoittaa tiedon suoraan.</span>
        </div>
        <div className="flex items-start gap-1.5">
          <TrustChip kind="analysis" />
          <span className="text-[11px] text-ink-300">— sovelluksen laskema tulos julkisesta aineistosta.</span>
        </div>
        <div className="flex items-start gap-1.5">
          <TrustChip kind="uncertain" />
          <span className="text-[11px] text-ink-300">— tietoa ei ole riittävästi vahvistettu.</span>
        </div>
      </dl>
    </div>
  );
}

/** Kiinteä varoitus sisältöanalyysistä (section 18/33). */
export function ContentAnalysisDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`rounded-lg border border-line bg-surface px-3 text-[12px] leading-relaxed text-muted ${compact ? "py-2" : "py-3"}`}>
      <strong>Sisältöanalyysi ei osoita toimittajan henkilökohtaista poliittista mielipidettä.</strong>{" "}
      Alla olevat jakaumat kertovat mitä ja ketä julkisessa aineistossa on käsitelty — ne ovat
      automaattista analyysia (◐), eivät väitteitä kenenkään kannasta.
    </p>
  );
}