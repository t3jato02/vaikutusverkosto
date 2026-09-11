"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AssistAction = "clarify" | "shorten" | "formal" | "question" | "references" | "check_facts";

const ACTION_LABELS: Record<AssistAction, string> = {
  clarify: "Selkeytä",
  shorten: "Lyhennä",
  formal: "Muodollisempi",
  question: "Kysymykseksi",
  references: "Lisää päätöksen lähteet",
  check_facts: "Tarkista väittämät",
};

export default function MessageComposer({
  decisionId,
  campaignId,
  initialSubject,
  initialBody,
  planCode,
}: {
  decisionId: string;
  campaignId: string;
  initialSubject: string;
  initialBody: string;
  planCode: string;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [busy, setBusy] = useState<AssistAction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [claims, setClaims] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => ({ subject: subject.length, body: body.length }), [subject, body]);

  async function runAction(action: AssistAction) {
    setBusy(action);
    setNotice(null);
    setClaims([]);
    try {
      const res = await fetch("/api/vaikuta/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: body, decisionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "Toimenpide epäonnistui.");
        return;
      }
      if (action === "check_facts") {
        setClaims(data.claimsToVerify ?? []);
        setNotice(data.note ?? null);
        return;
      }
      if (typeof data.text === "string") setBody(data.text);
      setNotice(data.note ?? null);
    } catch {
      setNotice("Yhteys epäonnistui.");
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/vaikuta/campaigns/${encodeURIComponent(campaignId)}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice((data.errors ?? [data.error ?? "Virhe"]).join(", "));
        setSaving(false);
        return;
      }
      if (data.requiresModeration) {
        setNotice("Viesti ohjataan tarkistettavaksi ennen lähettämistä. Jatka esikatseluun.");
      }
      router.push(`/vaikuta/${encodeURIComponent(decisionId)}/preview?campaign=${encodeURIComponent(campaignId)}`);
    } catch {
      setNotice("Tallennus epäonnistui.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label htmlFor="msg-subject" className="label mb-1 block">
          Otsikko
        </label>
        <input
          id="msg-subject"
          className="input"
          value={subject}
          maxLength={140}
          required
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Esimerkki 20 merkkiä tai lyhyempi otsikko"
        />
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="msg-body" className="label">
            Näkemyksesi
          </label>
          <span className="text-[11px] text-ink-300 tabular-nums">{stats.body} merkkiä</span>
        </div>
        <textarea
          id="msg-body"
          className="input min-h-[220px] leading-relaxed"
          value={body}
          maxLength={20000}
          required
          onChange={(e) => setBody(e.target.value)}
          placeholder="Kerro omin sanoin, mitä haluat välittää ja miksi asia on mielestäsi tärkeä…"
        />
        <p className="mt-1 text-[11px] text-ink-500">
          Työkalu säilyttää kantasi. Se ei lisää väitteitä tai faktoja puolestasi.
        </p>
      </div>

      <div>
        <p className="label mb-1">AI-avustaja (prototyyppi, sääntöpohjainen)</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ACTION_LABELS) as AssistAction[]).map((a) => (
            <button key={a} type="button" className="chip" disabled={busy !== null} onClick={() => runAction(a)}>
              {busy === a ? "…" : ACTION_LABELS[a]}
            </button>
          ))}
        </div>
        {notice && <p className="mt-2 text-[12px] text-muted" aria-live="polite">{notice}</p>}
        {claims.length > 0 && (
          <ul className="mt-2 space-y-1 rounded border border-warning/40 bg-warning-soft px-3 py-2 text-[12px] text-ink-700">
            <li className="font-medium">Tarkista ennen lähetystä:</li>
            {claims.map((c, i) => (
              <li key={i}>· {c}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href={`/vaikuta/${encodeURIComponent(decisionId)}/recipients?campaign=${encodeURIComponent(campaignId)}`} className="text-sm text-accent hover:underline">
          ← Vastaanottajat
        </a>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-ink-300 tabular-nums">{planCode}</span>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Tallennetaan…" : "Esikatselu →"}
          </button>
        </div>
      </div>
    </form>
  );
}