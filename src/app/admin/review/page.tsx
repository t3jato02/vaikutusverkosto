import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { entityUrlFor } from "@/lib/queries";
import { formatDateLong } from "@/lib/format";

export const metadata: Metadata = { title: "Tarkistusjono" };
export const dynamic = "force-dynamic";

export default async function AdminReviewPage() {
  const queue = await db.verificationQueue.findMany({
    orderBy: { createdAt: "asc" },
    where: { status: "PENDING" },
    take: 50,
  });
  const corrections = await db.correction.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { entity: { select: { id: true, canonicalName: true, type: true } } },
  });
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Tarkistusjono</h1>
      <section aria-label="Varmennusjono">
        <h2 className="card-title mb-2">VARMENNUSJONO ({queue.length})</h2>
        <ul className="card divide-y divide-ink-100">
          {queue.length === 0 && <li className="py-3 text-sm text-ink-500">Ei odottavia varmennuksia.</li>}
          {queue.map((q) => (
            <li key={q.id} className="py-2 text-xs">
              <span className="font-medium text-ink-900">#{q.id.slice(0, 8)}</span>
              <span className="text-ink-500"> · prioriteetti {q.priority} · {q.status}</span>
              {q.reason && <p className="text-ink-300">{q.reason}</p>}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Korjaushistoria">
        <h2 className="card-title mb-2">KORJAUSPYNNÖT</h2>
        <ul className="card divide-y divide-ink-100">
          {corrections.length === 0 && <li className="py-3 text-sm text-ink-500">Ei korjauspyyntöjä.</li>}
          {corrections.map((c) => (
            <li key={c.id} className="py-2.5 text-xs">
              <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase">{c.category}</span>{" "}
              <span className="text-ink-900">{c.description}</span>
              <span className="block text-ink-300">
                {formatDateLong(c.createdAt)} · {c.status}
                {c.entity && (
                  <Link href={entityUrlFor(c.entity.id, c.entity.type, c.entity.canonicalName)} className="ml-2 text-accent hover:underline">
                    {c.entity.canonicalName}
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}