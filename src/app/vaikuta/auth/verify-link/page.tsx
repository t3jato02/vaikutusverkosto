"use client";

import { useState } from "react";
import Link from "next/link";

export default function VerifyLinkPage() {
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vaikuta/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) { window.location.href = "/vaikuta/auth/signin"; return; }
        setError(data.error ?? "Uudelleenlähetys epäonnistui.");
        setBusy(false);
        return;
      }
      setVerifyUrl(data.verifyUrl);
      setBusy(false);
    } catch {
      setError("Yhteydenotto epäonnistui.");
      setBusy(false);
    }
  }

  if (verifyUrl) {
    return (
      <div className="mx-auto mt-10 max-w-sm space-y-3">
        <div className="card space-y-3">
          <h1 className="text-lg font-bold">Vahvista sähköposti (prototyyppi)</h1>
          <p className="text-xs text-ink-500">
            Varsinaista sähköpostipalvelua ei ole kytketty, joten näytämme vahvistuslinkin suoraan.
          </p>
          <a href={verifyUrl} className="btn-primary w-full">Vahvista sähköposti</a>
          <Link href="/vaikuta" className="btn w-full">Vaikuta-aloittelu</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card space-y-3">
        <h1 className="text-lg font-bold">Vahvista sähköposti</h1>
        <p className="text-xs text-ink-500">
          Kampanjan luonti vaatii vahvistetun sähköpostin. Käytä alla olevaa painiketta tuottaaksesi
          vahvistuslinkin (prototyyppi: linkki näytetään näytöllä, sähköpostia ei lähetetä).
        </p>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <button type="button" className="btn-primary w-full" onClick={resend} disabled={busy}>
          {busy ? "Luodaan…" : "Luo vahvistuslinkki"}
        </button>
      </div>
    </div>
  );
}