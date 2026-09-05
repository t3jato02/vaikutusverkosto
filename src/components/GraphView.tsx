"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { NODE_COLORS, RELATIONSHIP_TYPE_LABELS, FLOW_COLOR } from "@/lib/constants";
import { formatEur, formatDate } from "@/lib/format";

export interface GraphNodeData {
  id: string;
  label: string;
  type: string;
  subtype?: string | null;
  sourceCount: number;
}
export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
  role?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  confidence: string;
  flow?: boolean;
  amount?: number | null;
  currency?: string | null;
  sourceUrl?: string | null;
}

const FILTER_GROUPS: Record<string, { label: string; types: string[] }> = {
  political: { label: "Politiikka", types: ["MEMBER_OF", "SITS_IN", "REPRESENTS", "CANDIDATE_OF", "PART_OF", "VOTED_FOR", "VOTED_AGAINST", "INTRODUCED"] },
  money: { label: "Rahavirrat", types: ["DONATED_TO", "FUNDED_BY", "FUNDS", "RECEIVED_GRANT_FROM", "PAID", "INVESTED_IN"] },
  ownership: { label: "Omistus", types: ["OWNS", "SHAREHOLDER_OF", "BENEFICIAL_OWNER_OF", "OWNS_MEDIA"] },
  appointment: { label: "Nimitykset", types: ["APPOINTED_BY", "APPOINTED_TO"] },
  lobbying: { label: "Vaikuttaminen", types: ["LOBBIED", "MET_WITH", "ADVISER_TO", "CONSULTING_PAYMENT"] },
  governance: { label: "Hallinto", types: ["BOARD_MEMBER_OF", "CHAIRS", "EMPLOYED_BY", "SUPERVISES", "REGULATES", "DECIDED"] },
  education: { label: "Koulutus", types: ["EDUCATED_AT", "MEMBER_OF"] },
};

function nodeStyle(type: string): { shape: string; color: string } {
  const color = NODE_COLORS[type as keyof typeof NODE_COLORS] ?? "#777";
  const shape =
    type === "PERSON"
      ? "ellipse"
      : type === "COMPANY"
        ? "round-rectangle"
        : type === "POLITICAL_PARTY"
          ? "round-rectangle"
          : type === "DECISION"
            ? "diamond"
            : "rectangle";
  return { shape, color };
}

export default function GraphView({ entityId }: { entityId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const centerIdRef = useRef<string>(entityId);
  const [depth, setDepth] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdgeData | null>(null);
  const [showFlows, setShowFlows] = useState(true);
  const [timeYear, setTimeYear] = useState<number | null>(null);
  const [minYear, setMinYear] = useState(2011);
  const [maxYear, setMaxYear] = useState(2026);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(Object.keys(FILTER_GROUPS)));
  const [fullscreen, setFullscreen] = useState(false);

  const renderGraph = useCallback(
    (centerId: string, nodes: GraphNodeData[], edges: GraphEdgeData[], d: number) => {
      if (!containerRef.current) return;
      centerIdRef.current = centerId;
      const elements: ElementDefinition[] = nodes.map((n) => {
        const { shape, color } = nodeStyle(n.type);
        return {
          data: { id: n.id, label: n.label, type: n.type, subtype: n.subtype, sourceCount: n.sourceCount },
          classes: `type-${n.type}`,
          style: {
            shape,
            "background-color": color,
            "border-color": color,
            color: "#fff",
          },
        };
      });
      for (const e of edges) {
        const flow = !!e.flow;
        const inFilter = flow ? showFlows : [...activeFilters].some((k) => FILTER_GROUPS[k].types.includes(e.type));
        if (!inFilter) continue;
        if (timeYear !== null) {
          const sy = e.startDate ? new Date(e.startDate).getFullYear() : null;
          const ey = e.endDate ? new Date(e.endDate).getFullYear() : null;
          if (sy !== null && sy > timeYear) continue;
          if (ey !== null && ey < timeYear) continue;
        }
        elements.push({
          data: {
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
            type: e.type,
            role: e.role,
            startDate: e.startDate,
            endDate: e.endDate,
            confidence: e.confidence,
            flow,
            amount: e.amount,
            currency: e.currency,
            sourceUrl: e.sourceUrl,
          },
          classes: `${flow ? "flow-edge" : "rel-edge"} ${e.confidence}`,
        });
      }

      const cy =
        cyRef.current ??
        cytoscape({
          container: containerRef.current,
          elements,
          style: [            {
              selector: "node",
              style: {
                label: "data(label)",
                "font-size": 11,
                "text-valign": "bottom",
                "text-halign": "center",
                "text-margin-y": 6,
                color: "#23282e",
                "text-wrap": "wrap",
                "text-max-width": "110px",
                "border-width": 1,
                "border-color": "#ffffff",
                width: "mapData(sourceCount, 0, 50, 26, 52)",
                height: "mapData(sourceCount, 0, 50, 26, 52)",
              },
            },
            { selector: "node:selected", style: { "border-width": 3, "border-color": "#0f5ea8" } },
            {
              selector: "edge",
              style: {
                "curve-style": "bezier",
                "target-arrow-shape": "triangle",
                "target-arrow-color": "#9aa1ab",
                "line-color": "#c9ced4",
                width: 1.4,
                "arrow-scale": 0.8,
                label: "data(label)",
                "font-size": 8,
                "text-rotation": "autorotate",
                "text-background-color": "#ffffff",
                "text-background-opacity": 0.85,
                "text-background-padding": "1px",
              },
            },
            {
              selector: "edge.flow-edge",
              style: {
                "line-color": FLOW_COLOR,
                "target-arrow-color": FLOW_COLOR,
                width: 2.6,
                "target-arrow-shape": "triangle",
              },
            },
            { selector: "edge.MEDIUM", style: { "line-style": "dashed" } },
            { selector: "edge.LOW, edge.DISPUTED", style: { "line-style": "dotted", opacity: 0.6 } },
            { selector: ".type-POLITICAL_PARTY", style: { "background-color": "#b0652f" } },
          ],
          layout: { name: "cose", animate: false, nodeRepulsion: 7000, idealEdgeLength: 90 },
          wheelSensitivity: 0.35,
          minZoom: 0.15,
          maxZoom: 4,
        });
      if (!cyRef.current) {
        cyRef.current = cy;
        cy.on("tap", "node", (evt) => {
          const id = evt.target.id();
          if (id !== centerIdRef.current) {
            window.open(`/entity/${id}`, "_self");
          }
        });
        cy.on("tap", "edge", (evt) => {
          setSelectedEdge(evt.target.data() as GraphEdgeData);
        });
        cy.on("tap", (evt) => {
          if (evt.target === cy) setSelectedEdge(null);
        });
        cy.on("dbltap", "node", (evt) => {
          const id = evt.target.id();
          if (id !== centerIdRef.current) setDepth((p) => p + 1);
        });
      }

      if (d > 1) {
        // Merge newly fetched nodes/edges into the existing graph.
        cy.add(elements.filter((e) => !cy.getElementById(e.data!.id as string).length));
      } else {
        cy.elements().remove();
        cy.add(elements);
      }
      cy.layout({ name: "cose", animate: false, nodeRepulsion: 7000, idealEdgeLength: 90 }).run();
    },
    [activeFilters, timeYear, showFlows],
  );

  const loadGraph = useCallback(
    async (id: string, d: number) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/entities/${id}/graph?depth=${d}&flows=${showFlows}`);
        if (!res.ok) throw new Error("Graph fetch failed");
        const data = await res.json();
        const years = (data.edges ?? [])
          .map((e: GraphEdgeData) => (e.startDate ? new Date(e.startDate).getFullYear() : null))
          .filter((y: number | null) => y !== null) as number[];
        if (years.length) {
          setMinYear(Math.min(...years));
          setMaxYear(Math.max(...years));
        }
        renderGraph(id, data.nodes ?? [], data.edges ?? [], d);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [renderGraph, showFlows],
  );

  useEffect(() => {
    loadGraph(entityId, depth);
  }, [entityId, depth, loadGraph]);

  useEffect(() => {
    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, []);

  const toggleFilter = (k: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(k)) {
        next.delete(k);
      } else {
        next.add(k);
      }
      return next;
    });
  };

  return (
    <div className={`relative ${fullscreen ? "fixed inset-0 z-50 bg-white p-4" : ""}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <button className="btn" onClick={() => setDepth((p) => p - 1)} disabled={depth <= 1}>
          −
        </button>
        <span className="text-ink-500">Syvyys {depth}</span>
        <button className="btn" onClick={() => setDepth((p) => p + 1)} disabled={depth >= 4}>
          +
        </button>
        <label className="ml-2 inline-flex items-center gap-1.5">
          <input type="checkbox" checked={showFlows} onChange={() => setShowFlows((v) => !v)} />
          Rahavirrat
        </label>
        <label className="inline-flex items-center gap-1.5">
          <span className="text-ink-500">Aika</span>
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={timeYear ?? maxYear}
            onChange={(e) => setTimeYear(Number(e.target.value))}
            className="w-28"
            aria-label="Suodata verkosto aikajanalla"
          />
          <span className="w-10 tabular-nums text-ink-700">{timeYear ?? maxYear}</span>
        </label>
        <button className="btn" onClick={() => cyRef.current?.fit()}>
          Sovita
        </button>
        <button className="btn" onClick={() => setFullscreen((v) => !v)}>
          {fullscreen ? "Sulje" : "Koko näyttö"}
        </button>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {Object.entries(FILTER_GROUPS).map(([k, g]) => (
          <button
            key={k}
            onClick={() => toggleFilter(k)}
            className={`rounded border px-2 py-1 text-[11px] font-medium ${
              activeFilters.has(k)
                ? "border-accent bg-accent/10 text-accent"
                : "border-ink-100 bg-white text-ink-500"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="cy-container rounded-lg border border-ink-100 bg-white" />
      {loading && <div className="absolute inset-0 grid place-items-center bg-white/70 text-sm text-ink-500">Ladataan verkostoa…</div>}
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      {selectedEdge && (
        <div className="mt-2 rounded-lg border border-ink-100 bg-white p-3 text-sm shadow">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">{selectedEdge.label}</span>
            <button onClick={() => setSelectedEdge(null)} aria-label="Sulje" className="text-ink-300">
              ✕
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className="text-ink-500">Tyyppi</dt>
            <dd>{RELATIONSHIP_TYPE_LABELS[selectedEdge.type as keyof typeof RELATIONSHIP_TYPE_LABELS]?.fi ?? selectedEdge.type}</dd>
            {selectedEdge.role && (
              <>
                <dt className="text-ink-500">Rooli</dt>
                <dd>{selectedEdge.role}</dd>
              </>
            )}
            {selectedEdge.amount != null && (
              <>
                <dt className="text-ink-500">Summa</dt>
                <dd>{formatEur(selectedEdge.amount)}</dd>
              </>
            )}
            <dt className="text-ink-500">Aika</dt>
            <dd>
              {formatDate(selectedEdge.startDate)} → {selectedEdge.endDate ? formatDate(selectedEdge.endDate) : "nykyhetki"}
            </dd>
            <dt className="text-ink-500">Luottamus</dt>
            <dd>{selectedEdge.confidence}</dd>
          </dl>
          {selectedEdge.sourceUrl && (
            <a
              href={selectedEdge.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs text-accent underline"
            >
              Lähde: {selectedEdge.sourceUrl}
            </a>
          )}
        </div>
      )}
    </div>
  );
}