"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SimulateDelivery({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/vaikuta/campaigns/${encodeURIComponent(campaignId)}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "Toimitussimulaatio epäonnistui.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setNotice("Toimitussimulaatio epäonnistui.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn-primary" onClick={run} disabled={busy}>
        {busy ? "Käsitellään…" : "Simuloi toimitus"}
      </button>
      {notice && <p className="text-[12px] text-warning">{notice}</p>}
    </div>
  );
}