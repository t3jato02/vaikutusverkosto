import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminSession())) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="label">YLLÄPITO</span>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="text-xs text-ink-500 hover:underline">
            Kirjaudu ulos
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}