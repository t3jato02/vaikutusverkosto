"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartCampaignButton({
  decisionId,
  emailVerified,
}: {
  decisionId: string;
  emailVerified: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vaikuta/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId }),
      });
      if (res.status === 401) {
        router.push(`/vaikuta/auth/signin?next=/vaikuta/${encodeURIComponent(decisionId)}`);
        return;
      }
      if (res.status === 403) {
        router.push(`/vaikuta/auth/verify-link?next=/vaikuta/${encodeURIComponent(decisionId)}`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Kampanjan luonti epäonnistui.");
        setBusy(false);
        return;
      }
      router.push(`/vaikuta/${encodeURIComponent(decisionId)}/recipients?campaign=${encodeURIComponent(data.campaignId)}`);
    } catch {
      setError("Yhteydenotto epäonnistui.");
      setBusy(false);
    }
  }

  if (!emailVerified) {
    return (
      <div className="space-y-2">
        <a href={`/vaikuta/auth/signin?next=/vaikuta/${encodeURIComponent(decisionId)}`} className="btn-primary">
          Kirjaudu ja vahvista sähköposti
        </a>
        <p className="text-[12px] text-ink-500">Vahvistettu sähköposti vaaditaan kampanjan aloittamiseen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn-primary" onClick={start} disabled={busy}>
        {busy ? "Valmistellaan…" : "Vaikuta tähän päätökseen — aloita kampanja"}
      </button>
      {error && <p className="text-[12px] text-red-700">{error}</p>}
      <p className="text-[12px] text-ink-500">
        Ilmainen tutkiminen ja viestiluonnos. Toimitus edellyttää maksun simulointia.
      </p>
    </div>
  );
}