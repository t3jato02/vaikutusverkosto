"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vaikuta/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Rekisteröinti epäonnistui.");
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
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold">Sähköpostivahvistus (prototyyppi)</h2>
        <p className="text-xs text-ink-500">
          Varsinaista sähköpostipalvelua ei ole kytketty päälle, joten vahvistuslinkki näytetään suoraan.
        </p>
        <a href={verifyUrl} className="btn-primary w-full">
          Vahvista sähköposti
        </a>
        <button type="button" className="btn w-full" onClick={() => router.push(`/vaikuta/auth/signin?ok=registered`)}>
          Kirjaudu sisään
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div>
        <label htmlFor="reg-email" className="label mb-1 block">Sähköposti</label>
        <input id="reg-email" type="email" className="input" value={email} required onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div>
        <label htmlFor="reg-password" className="label mb-1 block">Salasana (vähintään 8 merkkiä)</label>
        <input id="reg-password" type="password" className="input" value={password} minLength={8} required onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Luodaan…" : "Luo tili"}
      </button>
    </form>
  );
}