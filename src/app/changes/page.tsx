import Link from "next/link";
import { getRecentChanges, entityUrlFor } from "@/lib/queries";
import { CHANGE_EVENT_LABELS } from "@/lib/constants";
import { formatDateLong, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ChangesPage() {
  const changes = await getRecentChanges(100);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">Muutosvirta</h1>
        <p className="mt-1 text-sm text-ink-500">
          Mitä verkostossa on muuttunut: nimitykset, yhteydet, rahavirrat ja päätökset
          muutoshavaitsijan merkitseminä.
        </p>
      </header>
      <ul className="card divide-y divide-ink-100">
        {changes.length === 0 && <li className="py-4 text-sm text-ink-500">Ei muutoksia vielä.</li>}
        {changes.map((c) => (
          <li key={c.id} className="flex items-start gap-3 py-3">
            <span
              className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: c.entity ? "#0f5ea8" : "#c9ced4" }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-ink-900">
                  {CHANGE_EVENT_LABELS[c.eventType]?.fi ?? c.eventType}
                </span>
                {c.entity && (
                  <Link
                    href={entityUrlFor(c.entity.id, c.entity.type, c.entity.canonicalName)}
                    className="text-accent hover:underline"
                  >
                    {c.entity.canonicalName}
                  </Link>
                )}
              </div>
              <p className="text-xs text-ink-500">{c.description}</p>
            </div>
            <span className="shrink-0 text-[11px] text-ink-300" title={formatDateLong(c.occurredAt)}>
              {relativeTime(c.occurredAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}