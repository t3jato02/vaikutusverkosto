import type { Metadata } from "next";
import Link from "next/link";
import { consumeEmailVerificationToken } from "@/lib/vaikuta/authUser";

export const metadata: Metadata = { title: "Sähköpostin vahvistus" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) {
    return <VerifyBox ok={false} message="Vahvistuslinkki puuttuu." />;
  }
  const userId = await consumeEmailVerificationToken(token);
  if (!userId) {
    return <VerifyBox ok={false} message="Vahvistuslinkki on virheellinen tai vanhentunut." />;
  }
  return <VerifyBox ok message="Sähköposti vahvistettu. Voit nyt kirjautua ja aloittaa kampanjan." />;
}

function VerifyBox({ ok, message }: { ok: boolean; message: string }) {
  return (
    <div className="mx-auto mt-10 max-w-sm space-y-4">
      <div className={`card space-y-3 ${ok ? "border-verified/40" : "border-warning/40"}`}>
        <h1 className="text-lg font-bold">{ok ? "Vahvistettu" : "Vahvistaminen epäonnistui"}</h1>
        <p className="text-sm text-ink-700">{message}</p>
        <div className="flex gap-2">
          <Link href="/vaikuta/auth/signin" className="btn-primary">Kirjaudu sisään</Link>
          <Link href="/vaikuta" className="btn">Vaikuta-aloittelu</Link>
        </div>
      </div>
    </div>
  );
}