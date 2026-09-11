import { activePlans, VAIKUTA_PRECISE_LABEL, type PlanConfig } from "@/lib/vaikuta/pricing";
import { formatMinor } from "@/lib/vaikuta/money";

// Pricing table rendered purely from the central pricing config. Prices are
// never hard-coded elsewhere in the UI.
export function PriceTag({ plan }: { plan: PlanConfig }) {
  if (plan.contactSales) {
    return <span className="text-2xl font-bold tracking-tight">Ota yhteyttä</span>;
  }
  if (plan.priceMinor === 0) {
    return <span className="text-2xl font-bold tracking-tight">€0</span>;
  }
  return (
    <span className="text-2xl font-bold tracking-tight tabular-nums">{formatMinor(plan.priceMinor)}</span>
  );
}

export function PricingTable() {
  const plans = activePlans();
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {plans.map((p) => (
          <div key={p.code} className={`card-pad flex flex-col ${p.code === "VAIKUTA_PASS" ? "border-accent/50" : ""}`}>
            <p className="label">{p.name}</p>
            <div className="mt-2">
              <PriceTag plan={p} />
              <p className="mt-1 text-[11px] text-ink-500">
                {p.billingPeriod === "monthly" ? "/ kuukausi" : p.billingPeriod === "one_time" ? "/ kampanja" : ""}
              </p>
            </div>
            <p className="mt-2 text-[13px] leading-snug text-muted">{p.tagline}</p>
            <ul className="mt-3 space-y-1.5 text-[13px] text-ink-700">
              {p.features.map((f) => (
                <li key={f} className="flex gap-1.5">
                  <span className="text-accent" aria-hidden>·</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-ink-500">{VAIKUTA_PRECISE_LABEL}</p>
    </div>
  );
}