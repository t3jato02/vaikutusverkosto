"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import cytoscape, { type Core } from "cytoscape";

interface GNode { id: string; label: string; kind: string; country?: string | null }
interface GEdge {
  id: string; source: string; target: string; amount: number; currency: string;
  fundingType: string | null; year: number | null; verification: string; sourceCount: number; flowId: string;
}

const KIND_COLOR: Record<string, string> = {
  country: "#64748b",
  funder: "#2563eb",
  intermediary: "#a855f7",
  recipient: "#0d9488",
  project: "#d97706",
};

function fmtEur(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M€`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} k€`;
  return `${Math.round(n)} €`;
}

export default function ForeignFlowGraph({ query }: { query: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selected, setSelected] = useState<GEdge | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [limit, setLimit] = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/foreign-funding?view=graph&limit=${limit}${query ? `&${query}` : ""}`);
      if (!res.ok) throw new Error(String(res.status));
      const data: { nodes: GNode[]; edges: GEdge[] } = await res.json();
      setEmpty(data.edges.filter((e) => e.flowId).length === 0);
      if (!ref.current) return;
      cyRef.current?.destroy();
      const cy = cytoscape({
        container: ref.current,
        elements: [
          ...data.nodes.map((n) => ({ data: { id: n.id, label: n.label, kind: n.kind } })),
          ...data.edges.map((e) => ({ data: { ...e, weight: e.flowId ? Math.max(1, Math.log10(e.amount + 10)) : 0.5 } })),
        ],
        style: [
          { selector: "node", style: { "background-color": (n: cytoscape.NodeSingular) => KIND_COLOR[n.data("kind")] ?? "#888", label: "data(label)", color: "#0f172a", "font-size": 8, "text-wrap": "wrap", "text-max-width": "90px", "text-valign": "bottom", width: 14, height: 14 } },
          { selector: "edge", style: { width: "data(weight)", "line-color": (e: cytoscape.EdgeSingular) => (e.data("flowId") ? "#0d9488" : "#cbd5e1"), "target-arrow-color": "#0d9488", "target-arrow-shape": (e: cytoscape.EdgeSingular) => (e.data("flowId") ? "triangle" : "none"), "curve-style": "bezier", opacity: 0.75 } },
          { selector: "edge:selected", style: { "line-color": "#dc2626", "target-arrow-color": "#dc2626", opacity: 1 } },
        ],
        layout: { name: "cose", animate: false, nodeRepulsion: 8000, idealEdgeLength: 70 },
        minZoom: 0.2,
        maxZoom: 2.5,
      });
      cy.on("tap", "edge", (evt) => {
        const d = evt.target.data() as GEdge;
        setSelected(d.flowId ? d : null);
      });
      cy.on("tap", (evt) => { if (evt.target === cy) setSelected(null); });
      cyRef.current = cy;
    } catch {
      setEmpty(true);
    } finally {
      setLoading(false);
    }
  }, [limit, query]);

  useEffect(() => { load(); return () => cyRef.current?.destroy(); }, [load]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <label>Näytettävät virrat:</label>
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="input h-7 py-0 text-xs">
          {[30, 60, 100, 150].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        {loading && <span className="text-ink-400">ladataan…</span>}
      </div>
      <div className="relative max-w-full overflow-hidden rounded-lg border border-ink-100">
        <div ref={ref} className="h-[420px] w-full" role="img" aria-label="Rahavirtojen verkosto" />
        {empty && !loading && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-500">
            Ei näytettäviä rahavirtoja näillä suodattimilla.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-500">
        {Object.entries(KIND_COLOR).map(([k, c]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} /> {k}
          </span>
        ))}
      </div>
      {selected && (
        <div className="card break-words text-xs">
          <p className="font-semibold text-ink-900">Rahavirta</p>
          <p className="mt-1 text-ink-600">
            {fmtEur(selected.amount)} {selected.currency}
            {selected.fundingType ? ` · ${selected.fundingType}` : ""}
            {selected.year ? ` · ${selected.year}` : ""} · {selected.verification} · {selected.sourceCount} lähde(ttä)
          </p>
          <a
            href={`/foreign#flow-${selected.flowId}`}
            className="mt-1 inline-block text-accent hover:underline"
          >
            Avaa rivi ja lähteet →
          </a>
        </div>
      )}
    </div>
  );
}
