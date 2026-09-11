"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vaikuta/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Kirjautuminen epäonnistui.");
        setBusy(false);
        return;
      }
      const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/vaikuta";
      router.push(dest);
    } catch {
      setError("Yhteydenotto epäonnistui.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div>
        <label htmlFor="si-email" className="label mb-1 block">Sähköposti</label>
        <input id="si-email" type="email" className="input" value={email} required onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div>
        <label htmlFor="si-password" className="label mb-1 block">Salasana</label>
        <input id="si-password" type="password" className="input" value={password} required onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Kirjaudutaan…" : "Kirjaudu"}
      </button>
    </form>
  );
}