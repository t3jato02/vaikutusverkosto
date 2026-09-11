import Link from "next/link";
import type { RecentChange } from "@/lib/queries";
import { groupRecentChanges, entityUrlFor } from "@/lib/queries";
import { changeEventSentence, changeEventGroupSentence } from "@/lib/labels";
import { CHANGE_EVENT_LABELS } from "@/lib/constants";
import { formatEur, relativeTime, formatDateLong } from "@/lib/format";

function amountText(c: RecentChange): string | null {
  if (!c.flow?.amount) return null;
  return `${formatEur(c.flow.amount)}${c.flow.currency && c.flow.currency !== "EUR" ? ` ${c.flow.currency}` : ""}`;
}

function sentenceFor(c: RecentChange): string {
  return changeEventSentence({
    eventType: c.eventType,
    entityName: c.subject?.canonicalName,
    counterpartName: c.counterpart?.canonicalName,
    relationshipType: c.relationship?.relationshipType ?? null,
    amountText: amountText(c),
  });
}

function bulkTotalEur(items: RecentChange[]): number {
  return items.reduce((sum, c) => sum + (c.flow?.amount ? Number(c.flow.amount) : 0), 0);
}

export default function ChangesList({
  changes,
  compact = false,
  maxGroups,
}: {
  changes: RecentChange[];
  compact?: boolean;
  maxGroups?: number;
}) {
  let groups = groupRecentChanges(changes);
  if (maxGroups) groups = groups.slice(0, maxGroups);

  if (groups.length === 0) {
    return <p className="py-3 text-sm text-muted">Ei muutoksia vielä.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {groups.map((g) => {
        const grouped = g.items.length > 1;
        const first = g.items[0];
        const kind = CHANGE_EVENT_LABELS[g.eventType]?.fi ?? "Muutos";

        let headline: React.ReactNode;
        let sentence: string;
        if (g.bulk) {
          const total = bulkTotalEur(g.items);
          const noun =
            g.eventType === "NEW_GRANT"
              ? `${g.items.length} uutta rahoituserää`
              : g.eventType === "NEW_CONTRACT"
                ? `${g.items.length} uutta sopimusta`
                : `${g.items.length} toimijan tiedot päivittyivät`;
          headline = <span className="text-sm font-semibold text-ink">{noun}</span>;
          sentence =
            total > 0
              ? `Tuoreessa tuonnissa yhteensä ${formatEur(total)}`
              : "Kirjattu tuoreimmassa tietojen päivityksessä";
        } else {
          headline = g.subject ? (
            <Link
              href={entityUrlFor(g.subject.id, g.subject.type, g.subject.canonicalName)}
              className="text-sm font-semibold text-ink hover:text-accent"
            >
              {g.subject.canonicalName}
            </Link>
          ) : null;
          const sharedRelType = g.items.every(
            (it) => it.relationship?.relationshipType === first.relationship?.relationshipType,
          )
            ? (first.relationship?.relationshipType ?? null)
            : null;
          sentence = grouped
            ? changeEventGroupSentence({ eventType: g.eventType, count: g.items.length, relationshipType: sharedRelType })
            : sentenceFor(first);
        }

        return (
          <li key={g.key} className={compact ? "flex items-start justify-between gap-3 py-2.5" : "flex items-start gap-3 py-3"}>
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{kind}</span>
                {headline}
              </div>
              <p className={compact ? "truncate text-xs text-muted" : "mt-0.5 text-[13px] text-muted"}>{sentence}</p>
              {(grouped || g.bulk) && !compact && (
                <details className="mt-1 text-xs text-muted">
                  <summary className="cursor-pointer select-none text-accent hover:underline">
                    Näytä {Math.min(g.items.length, 20)} / {g.items.length}
                  </summary>
                  <ul className="mt-1 space-y-0.5 border-l border-line pl-3">
                    {g.items.slice(0, 20).map((it) => (
                      <li key={it.id}>
                        {it.subject ? <span className="text-ink-700">{it.subject.canonicalName}</span> : null}
                        {it.subject ? " — " : ""}
                        {sentenceFor(it)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <time
              dateTime={new Date(g.occurredAt).toISOString()}
              title={formatDateLong(g.occurredAt)}
              className="shrink-0 text-[11px] text-muted"
            >
              {relativeTime(g.occurredAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
