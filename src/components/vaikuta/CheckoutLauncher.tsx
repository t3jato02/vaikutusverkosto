"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMinor } from "@/lib/vaikuta/money";

export interface PlanOption {
  code: string;
  name: string;
  billingPeriod: string;
  priceMinor: number;
  recipientLimit: number;
  tagline: string;
}

export default function CheckoutLauncher({
  campaignId,
  decisionId,
  currentPlan,
  plans,
  hasActiveSubscription,
}: {
  campaignId: string;
  decisionId: string;
  currentPlan: string;
  plans: PlanOption[];
  hasActiveSubscription: boolean;
}) {
  const router = useRouter();
  const [planCode, setPlanCode] = useState(currentPlan);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setNotice(null);
    try {
      if (planCode !== currentPlan) {
        const planRes = await fetch(`/api/vaikuta/campaigns/${encodeURIComponent(campaignId)}/plan`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planCode }),
        });
        if (!planRes.ok) {
          const planData = await planRes.json().catch(() => ({}));
          setNotice(planData.error ?? "Suunnitelman vaihto epäonnistui.");
          setBusy(false);
          return;
        }
      }
      const res = await fetch(`/api/vaikuta/campaigns/${encodeURIComponent(campaignId)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "Kassan aloitus epäonnistui.");
        setBusy(false);
        return;
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      router.push(`/vaikuta/checkout/${encodeURIComponent(data.sessionId)}`);
    } catch {
      setNotice("Kassan aloitus epäonnistui.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="label">Valitse käyttösuunnitelma (kassassa päätetään palvelimella)</legend>
        {plans.map((p) => (
          <label key={p.code} className={`card flex cursor-pointer items-start gap-3 ${planCode === p.code ? "border-accent" : ""}`}>
            <input
              type="radio"
              name="plan"
              value={p.code}
              className="mt-1 h-4 w-4 accent-accent"
              checked={planCode === p.code}
              onChange={() => setPlanCode(p.code)}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-ink-900">{p.name}</span>
                <span className="text-sm font-semibold tabular-nums text-ink-900">
                  {p.priceMinor === 0 ? "€0" : formatMinor(p.priceMinor)}
                  {p.billingPeriod === "monthly" ? " / kk" : p.billingPeriod === "one_time" ? " / kampanja" : ""}
                </span>
              </span>
              <span className="block text-[12px] text-muted">{p.tagline}</span>
              <span className="block text-[11px] text-ink-500">Vastaanottajaraja: {p.recipientLimit}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {hasActiveSubscription && (
        <p className="text-[13px] text-ink-700">
          Aktiivinen tilauksesi on voimassa — lopullinen summa (mahdollisesti €0) päätetään
          palvelimella kassassa.
        </p>
      )}

      {notice && <p className="text-sm text-warning" aria-live="polite">{notice}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href={`/vaikuta/${encodeURIComponent(decisionId)}/preview?campaign=${encodeURIComponent(campaignId)}`} className="text-sm text-accent hover:underline">
          ← Esikatselu
        </a>
        <button type="button" className="btn-primary" onClick={start} disabled={busy}>
          {busy ? "Luodaan kassa…" : "Siirry kassaan"}
        </button>
      </div>
    </div>
  );
}