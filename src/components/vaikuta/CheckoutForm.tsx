"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMinor } from "@/lib/vaikuta/money";

export default function CheckoutForm({
  sessionId,
  campaignId,
  decisionId,
  amountMinor,
  currency,
  isMock,
  planCode,
  coveredBySubscription,
}: {
  sessionId: string;
  campaignId: string;
  decisionId: string;
  amountMinor: number;
  currency: string;
  isMock: boolean;
  planCode: string;
  coveredBySubscription: boolean;
}) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (paying) return;
    setPaying(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/vaikuta/checkout/${encodeURIComponent(sessionId)}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "Maksusimulaatio epäonnistui.");
        setPaying(false);
        return;
      }
      router.push(`/vaikuta/${encodeURIComponent(decisionId)}/confirmation?campaign=${encodeURIComponent(campaignId)}`);
    } catch {
      setNotice("Maksusimulaatio epäonnistui. Yritä uudelleen.");
      setPaying(false);
    }
  }

  return (
    <form onSubmit={confirm} className="space-y-4">
      {isMock && (
        <aside role="note" className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          <strong>Prototyyppikassa — maksua ei veloiteta.</strong> Korttitiedot ovat paikkamerkkejä;
          mitään ei tallenneta eikä lähetetä.
        </aside>
      )}

      <dl className="card divide-y divide-line text-sm">
        <div className="flex items-center justify-between py-2">
          <dt className="text-ink-500">Tuote</dt>
          <dd className="font-medium">{planCode === "FREE" ? "VAIKUTA (ilmainen tutkiminen)" : `VAIKUTA ${planCode === "VAIKUTA_PASS" ? "PASS" : planCode} — kampanja`}</dd>
        </div>
        <div className="flex items-center justify-between py-2">
          <dt className="text-ink-500">Summa</dt>
          <dd className="font-semibold tabular-nums">
            {coveredBySubscription ? "Katetaan tilauksesta" : formatMinor(amountMinor, currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between py-2">
          <dt className="text-ink-500">Kesto</dt>
          <dd>{coveredBySubscription ? "Kampanja tilausattribuutilla" : planCode === "VAIKUTA_PASS" ? "Kertamaksu (kampanja)" : "Kk-tilaus"}</dd>
        </div>
      </dl>

      <fieldset className="space-y-2 rounded-lg border border-line bg-surface p-3 text-sm">
        <legend className="label px-1">Kortti (simuloitu)</legend>
        <div>
          <label htmlFor="mock-card" className="label mb-1 block">Korttinumero</label>
          <input id="mock-card" className="input" disabled placeholder="•••• •••• •••• ••••" autoComplete="off" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="mock-exp" className="label mb-1 block">Voimassa</label>
            <input id="mock-exp" className="input" disabled placeholder="KK/VV" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="mock-cvc" className="label mb-1 block">CVC</label>
            <input id="mock-cvc" className="input" disabled placeholder="•••" autoComplete="off" />
          </div>
        </div>
      </fieldset>

      {notice && <p className="text-sm text-warning" aria-live="polite">{notice}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href={`/vaikuta/${encodeURIComponent(decisionId)}/preview?campaign=${encodeURIComponent(campaignId)}`} className="text-sm text-accent hover:underline">
          ← Esikatselu
        </a>
        <button type="submit" className="btn-primary" disabled={paying}>
          {paying ? "Käsitellään…" : "Vahvista maksusimulaatio"}
        </button>
      </div>
    </form>
  );
}