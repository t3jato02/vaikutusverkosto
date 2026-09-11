"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Candidate {
  entityId: string;
  name: string;
  subtype: string | null;
  role: string;
  organizationName: string | null;
  isMedia: boolean;
  dimension: string;
  reasonText: string;
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string | null;
  contactAvailability: string;
}

interface Group {
  key: string;
  label: string;
  isMedia: boolean;
  count: number;
}

const GROUP_LABELS: Record<string, { label: string; blurb: string }> = {
  decision_makers: { label: "Päätöksentekijät", blurb: "Henkilöt, joilla on dokumentoitu rooli päätöksessä tai päätöselimessä." },
  committee_and_preparation: { label: "Valmistelu ja valiokunta", blurb: "Valiokunnan jäsenet ja valmisteluun osallistuvat virkamiehet." },
  other_documented: { label: "Muut dokumentoidut toimijat", blurb: "Aloitteen tekijät ja muut lähteillä dokumentoidut toimijat." },
  media: { label: "Asiaa käsitellyt toimitus", blurb: "Toimittajat, jotka ovat raportoineet tästä asiasta. Eristetty päätöksentekijöistä." },
};

const GROUP_KEY: Record<string, string> = {
  vote: "decision_makers",
  minister: "decision_makers",
  mp_plenary: "decision_makers",
  committee_membership: "committee_and_preparation",
  chair_of_committee: "committee_and_preparation",
  official_preparation: "committee_and_preparation",
  formal_authorship: "other_documented",
  media_coverage: "media",
};

export default function RecipientPicker({
  decisionId,
  campaignId,
  planLimit,
  initialSelected,
}: {
  decisionId: string;
  campaignId: string;
  planLimit: number;
  initialSelected: string[];
}) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/vaikuta/decisions/${encodeURIComponent(decisionId)}/recipients`, { cache: "no-store" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Lataus epäonnistui.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setCandidates(data.candidates ?? []);
        setGroups(data.groups ?? []);
      } catch {
        if (!cancelled) setError("Yhteydenotto epäonnistui.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [decisionId]);

  const toggle = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else if (next.size < planLimit) next.add(id);
        else setNotice(`Enintään ${planLimit} vastaanottajaa tällä suunnitelmalla.`);
        return next;
      });
    },
    [planLimit],
  );

  const selectAllInGroup = useCallback(
    (groupKey: string) => {
      const ids = candidates.filter((c) => (c.isMedia ? groupKey === "media" : groupKey === (GROUP_KEY[c.dimension] ?? "other_documented"))).map((c) => c.entityId);
      setSelected((prev) => {
        const next = new Set(prev);
        const remaining = planLimit - next.size;
        const toAdd = ids.filter((id) => !next.has(id)).slice(0, Math.max(0, remaining));
        toAdd.forEach((id) => next.add(id));
        return next;
      });
    },
    [candidates, planLimit],
  );

  const byGroup = useMemo(() => {
    const map = new Map<string, Candidate[]>();
    for (const c of candidates) {
      const key = c.isMedia ? "media" : (GROUP_KEY[c.dimension] ?? "other_documented");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [candidates]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/vaikuta/campaigns/${encodeURIComponent(campaignId)}/recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityIds: [...selected] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "Tallennus epäonnistui.");
        setSaving(false);
        return;
      }
      router.push(`/vaikuta/${encodeURIComponent(decisionId)}/message?campaign=${encodeURIComponent(campaignId)}`);
    } catch {
      setNotice("Tallennus epäonnistui. Yritä uudelleen.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-label="Ladataan vastaanottajia">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card skeleton h-24" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="card-pad text-sm text-red-700">{error}</p>;
  }

  const mediaCount = candidates.filter((c) => c.isMedia).length;
  const makersCount = candidates.filter((c) => !c.isMedia).length;

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-500">
          Valittu <span className="font-semibold text-ink tabular-nums">{selected.size}</span> / {planLimit} vastaanottajaa.
        </p>
        <p className="text-[12px] text-ink-500" aria-live="polite">
          {mediaCount} toimituskohdetta · {makersCount} päätöksentekijää/valmistelijaa
        </p>
      </div>

      {groups.map((g) => {
        const items = byGroup.get(g.key) ?? [];
        if (items.length === 0) return null;
        const meta = GROUP_LABELS[g.key] ?? { label: g.label, blurb: "" };
        return (
          <fieldset key={g.key} className="card space-y-1">
            <legend className="sr-only">{meta.label}</legend>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
              <p className="text-sm font-semibold text-ink">
                {meta.label} <span className="font-normal text-ink-300 tabular-nums">({items.length})</span>
              </p>
              <button type="button" className="text-[11px] text-accent hover:underline" onClick={() => selectAllInGroup(g.key)}>
                Valitse kaikki ryhmästä
              </button>
            </div>
            {g.key === "media" && (
              <p className="rounded bg-amber-50 px-2 py-1.5 text-[12px] text-amber-900">
                Toimitus on erotettu päätöksentekijöistä: raportointi ei tarkoita roolia päätöksenteossa.
              </p>
            )}
            {!g.isMedia && <p className="text-[12px] text-ink-500">{meta.blurb}</p>}
            <ul className="divide-y divide-line pt-1">
              {items.map((c) => (
                <li key={c.entityId} className="py-2.5">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-accent"
                      checked={selected.has(c.entityId)}
                      onChange={() => toggle(c.entityId)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium text-ink-900">{c.name}</span>
                        <span className="text-xs text-ink-500">{c.role}</span>
                        {c.organizationName && <span className="text-xs text-ink-300">· {c.organizationName}</span>}
                        {c.isMedia && (
                          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">
                            Media
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-muted">
                        <strong className="font-medium">Miksi relevantti:</strong> {c.reasonText}
                      </span>
                      <span className="mt-1 block text-[11px] text-ink-500">
                        Lähde: <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">{c.sourceName}</a>
                        {c.verifiedAt ? ` · vahvistettu ${new Date(c.verifiedAt).toLocaleDateString("fi-FI")}` : ""} ·{" "}
                        {c.contactAvailability === "verified" || c.contactAvailability === "public_professional"
                          ? "Julkinen ammatillinen kanava"
                          : "Yhteystietoa ei ole varmistettu"}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}

      {notice && <p className="text-sm text-warning" aria-live="polite">{notice}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href={`/vaikuta/${encodeURIComponent(decisionId)}`} className="text-sm text-accent hover:underline">
          ← Takaisin asiaan
        </a>
        <button type="submit" className="btn-primary" disabled={saving || selected.size === 0}>
          {saving ? "Tallennetaan…" : "Seuraava: viesti →"}
        </button>
      </div>
    </form>
  );
}