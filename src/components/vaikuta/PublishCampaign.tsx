"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PublishCampaign({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [statement, setStatement] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/vaikuta/campaigns/${encodeURIComponent(campaignId)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicStatement: statement }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "Julkaisu epäonnistui.");
        setBusy(false);
        return;
      }
      router.push(data.publicUrl);
    } catch {
      setNotice("Julkaisu epäonnistui.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={publish} className="space-y-2">
      <label htmlFor="pub-statement" className="label block">
        Julkinen kannanotto (ei viestin sisältöä)
      </label>
      <textarea
        id="pub-statement"
        className="input"
        rows={3}
        value={statement}
        maxLength={2000}
        required
        onChange={(e) => setStatement(e.target.value)}
        placeholder="Julkinen, oma kannanotto esillä pidettäväksi kampanjasivulla…"
      />
      <button type="submit" className="btn" disabled={busy}>
        {busy ? "Julkaistaan…" : "Julkaise julkinen kampanjasivu"}
      </button>
      {notice && <p className="text-[12px] text-warning">{notice}</p>}
    </form>
  );
}