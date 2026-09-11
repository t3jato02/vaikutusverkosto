"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApproveToCheckout({ campaignId, decisionId }: { campaignId: string; decisionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vaikuta/campaigns/${encodeURIComponent(campaignId)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Hyväksyntä epäonnistui.");
        setBusy(false);
        return;
      }
      router.push(`/vaikuta/${encodeURIComponent(decisionId)}/checkout?campaign=${encodeURIComponent(campaignId)}`);
    } catch {
      setError("Hyväksyntä epäonnistui.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn-primary" onClick={approve} disabled={busy}>
        {busy ? "Käsitellään…" : "Hyväksyn lopullisen tekstin ja siirryn kassaan"}
      </button>
      {error && <p className="text-[12px] text-red-700">{error}</p>}
    </div>
  );
}