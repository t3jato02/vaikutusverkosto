import type { Metadata } from "next";
import Link from "next/link";
import { getVaikutaSession } from "@/lib/vaikuta/session";
import { RegisterForm } from "@/components/vaikuta/RegisterForm";

export const metadata: Metadata = { title: "Luo tili — Vaikuta" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const session = await getVaikutaSession();
  return (
    <div className="mx-auto mt-8 max-w-sm space-y-4">
      <div>
        <h1 className="text-lg font-bold">Luo tili — Vaikuta</h1>
        <p className="mt-1 text-xs text-ink-500">
          Ilmainen tutkiminen ja luonnos. Kampanjan toimitus edellyttää sähköpostin vahvistusta.
        </p>
      </div>
      {session.user ? (
        <div className="card space-y-2">
          <p className="text-sm">Olet kirjautunut sisään: <span className="font-medium">{session.user.email}</span></p>
          <Link href="/vaikuta" className="text-sm text-accent hover:underline">← Palaa Vaikuta-aloitteluun</Link>
        </div>
      ) : (
        <RegisterForm />
      )}
    </div>
  );
}