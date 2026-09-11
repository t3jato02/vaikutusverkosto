import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/vaikuta/SignInForm";

export const metadata: Metadata = { title: "Kirjaudu — Vaikuta" };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; ok?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : undefined;
  return (
    <div className="mx-auto mt-8 max-w-sm space-y-4">
      <div>
        <h1 className="text-lg font-bold">Kirjaudu — Vaikuta</h1>
        <p className="mt-1 text-xs text-ink-500">Tarvitset vahvistetun sähköpostin kampanjan luontiin.</p>
      </div>
      {sp.ok === "registered" && (
        <p className="rounded border border-verified/40 bg-verified-soft px-3 py-2 text-xs text-ink-700">
          Tili luotu. Vahvista sähköposti rekisteröitymisnäkymästä ennen kampanjan luontia.
        </p>
      )}
      <SignInForm next={next} />
      <p className="text-center text-sm">
        <Link href="/vaikuta/auth/register" className="text-accent hover:underline">Luo tili</Link>
      </p>
    </div>
  );
}