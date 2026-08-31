import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Kirjaudu" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  if (await isAdminSession()) {
    redirect(next && next.startsWith("/") ? next : "/admin");
  }
  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card space-y-4">
        <h1 className="text-lg font-bold">Ylläpitokirjautuminen</h1>
        <p className="text-xs text-ink-500">
          Tämä alue on tarkoitettu vain valtuutetuille ylläpitäjille. Julkinen data on
          kaikkien nähtävillä ilman kirjautumista.
        </p>
        {error === "invalid" && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Väärä salasana.
          </p>
        )}
        <form action="/api/auth/login" method="post" className="space-y-3">
          <input type="hidden" name="next" value={next && next.startsWith("/") ? next : "/admin"} />
          <label className="block text-sm">
            <span className="label mb-1 block">Salasana</span>
            <input type="password" name="password" className="input" autoFocus required />
          </label>
          <button type="submit" className="btn-primary w-full">Kirjaudu</button>
        </form>
      </div>
    </div>
  );
}