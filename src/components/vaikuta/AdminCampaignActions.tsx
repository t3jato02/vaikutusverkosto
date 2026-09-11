"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACTIONS = [
  { key: "clear_moderation", label: "Vapauta tarkistuksesta" },
  { key: "suspend", label: "Keskeytä" },
  { key: "resume", label: "Jatka" },
  { key: "close", label: "Sulje" },
  { key: "force_delivery_off", label: "Estä toimitus" },
] as const;

export default function AdminCampaignActions({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function act(action: (typeof ACTIONS)[number]["key"]) {
    setBusy(action);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/vaikuta/campaigns/${encodeURIComponent(campaignId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice(data.error ?? "Toimenpide epäonnistui.");
        setBusy(null);
        return;
      }
      router.refresh();
      setBusy(null);
    } catch {
      setNotice("Toimenpide epäonnistui.");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
      {ACTIONS.map((a) => (
        <button key={a.key} type="button" className="chip !min-h-0 !px-2 !py-0.5 !text-[11px]" disabled={busy !== null} onClick={() => act(a.key)}>
          {busy === a.key ? "…" : a.label}
        </button>
      ))}
      {notice && <span className="text-[11px] text-warning">{notice}</span>}
    </div>
  );
}