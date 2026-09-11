"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import cytoscape, {
  type Core,
  type ElementDefinition,
  type NodeSingular,
  type StylesheetStyle,
} from "cytoscape";
import { NODE_COLORS, FLOW_COLOR } from "@/lib/constants";

type Stylesheet = StylesheetStyle;
import { relationshipPhrase, verificationLabel, temporalLabel } from "@/lib/labels";
import { formatEur, formatDate } from "@/lib/format";
import type { RelationshipType, VerificationStatus, TemporalState } from "@prisma/client";
import Drawer from "@/components/Drawer";

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
  labelIn: string;
  role?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  confidence: string;
  verificationStatus: VerificationStatus;
  temporalState: TemporalState;
  flow?: boolean;
  amount?: number | null;
  currency?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
}

const REL_GROUPS: Record<string, { label: string; types: string[] }> = {
  political: { label: "Politiikka", types: ["MEMBER_OF", "SITS_IN", "REPRESENTS", "CANDIDATE_OF", "PART_OF", "VOTED_FOR", "VOTED_AGAINST", "INTRODUCED"] },
  money: { label: "Rahoitus", types: ["DONATED_TO", "FUNDED_BY", "FUNDS", "RECEIVED_GRANT_FROM", "PAID", "INVESTED_IN"] },
  ownership: { label: "Omistus", types: ["OWNS", "SHAREHOLDER_OF", "BENEFICIAL_OWNER_OF", "OWNS_MEDIA"] },
  appointment: { label: "Nimitykset", types: ["APPOINTED_BY", "APPOINTED_TO"] },
  governance: { label: "Hallinto", types: ["BOARD_MEMBER_OF", "CHAIRS", "EMPLOYED_BY", "SUPERVISES", "REGULATES", "DECIDED"] },
  lobbying: { label: "Vaikuttaminen", types: ["LOBBIED", "MET_WITH", "ADVISER_TO", "REGISTERED_LOBBY_ORGANIZATION", "REPRESENTS_INTERESTS_OF", "CLIENT_OF", "DECLARED_EU_INTEREST", "ACCREDITED_REPRESENTATIVE_OF"] },
  education: { label: "Koulutus", types: ["EDUCATED_AT"] },
};

const TIME_MODES = [
  { id: "current", label: "Nykyiset" },
  { id: "historical", label: "Historialliset" },
  { id: "all", label: "Kaikki" },
] as const;
type TimeMode = (typeof TIME_MODES)[number]["id"];

// Node-type visual language — restrained: colour + shape, no rainbow.
const TYPE_SHAPE: Record<string, string> = {
  PERSON: "ellipse",
  COMPANY: "round-rectangle",
  POLITICAL_PARTY: "round-rectangle",
  DECISION: "diamond",
  PROJECT: "diamond",
};
function nodeShape(type: string): string {
  return TYPE_SHAPE[type] ?? "round-rectangle";
}
function nodeColor(type: string): string {
  return NODE_COLORS[type as keyof typeof NODE_COLORS] ?? "#7d8b96";
}

const LEGEND: { type: string; label: string }[] = [
  { type: "PERSON", label: "Henkilö" },
  { type: "ORGANIZATION", label: "Organisaatio" },
  { type: "POLITICAL_PARTY", label: "Puolue" },
  { type: "COMPANY", label: "Yritys" },
  { type: "GOVERNMENT_BODY", label: "Julkisyhteisö" },
  { type: "EDUCATIONAL_INSTITUTION", label: "Oppilaitos" },
  { type: "DECISION", label: "Päätös" },
];

const INITIAL_VISIBLE = 34; // bounded first-degree view; the rest is "+N more"

export default function GraphView({ entityId }: { entityId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [depth, setDepth] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ nodes: GraphNodeData[]; edges: GraphEdgeData[] } | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [showFlows, setShowFlows] = useState(true);
  const [timeMode, setTimeMode] = useState<TimeMode>("current");
  const [activeGroups, setActiveGroups] = useState<Set<string>>(new Set(Object.keys(REL_GROUPS)));
  const [showAllNodes, setShowAllNodes] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/entities/${entityId}/graph?depth=${d}&flows=true`);
      if (!res.ok) throw new Error("Verkoston lataus epäonnistui");
      const json = await res.json();
      setData({ nodes: json.nodes ?? [], edges: json.edges ?? [] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    load(depth);
  }, [depth, load]);

  useEffect(() => () => {
    cyRef.current?.destroy();
    cyRef.current = null;
  }, []);

  const groupOf = (type: string): string | null => {
    for (const [k, g] of Object.entries(REL_GROUPS)) if (g.types.includes(type)) return k;
    return null;
  };

  const edgePassesTime = useCallback(
    (e: GraphEdgeData) => {
      if (timeMode === "all") return true;
      const isHistorical = e.temporalState === "HISTORICAL";
      return timeMode === "historical" ? isHistorical : !isHistorical;
    },
    [timeMode],
  );

  // Which first-degree neighbours to actually place. Rank by source count so the
  // best-attested connections show first; the tail collapses into "+N more".
  const { visibleNodeIds, hiddenCount } = useMemo(() => {
    if (!data) return { visibleNodeIds: new Set<string>(), hiddenCount: 0 };
    if (depth > 1 || showAllNodes) return { visibleNodeIds: new Set(data.nodes.map((n) => n.id)), hiddenCount: 0 };
    const others = data.nodes.filter((n) => n.id !== entityId).sort((a, b) => b.sourceCount - a.sourceCount);
    const keep = new Set<string>([entityId, ...others.slice(0, INITIAL_VISIBLE).map((n) => n.id)]);
    return { visibleNodeIds: keep, hiddenCount: Math.max(0, others.length - INITIAL_VISIBLE) };
  }, [data, depth, showAllNodes, entityId]);

  const render = useCallback(() => {
    if (!containerRef.current || !data) return;

    const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
    const elements: ElementDefinition[] = [];
    for (const n of data.nodes) {
      if (!visibleNodeIds.has(n.id)) continue;
      elements.push({
        data: { id: n.id, label: n.label, type: n.type, deg: n.sourceCount, center: n.id === entityId ? 1 : 0 },
        classes: `t-${n.type}${n.id === entityId ? " is-center" : ""}`,
      });
    }
    for (const e of data.edges) {
      if (!visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target)) continue;
      const grp = e.flow ? "money" : groupOf(e.type);
      if (e.flow ? !showFlows : grp && !activeGroups.has(grp)) continue;
      if (!edgePassesTime(e)) continue;
      elements.push({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.target === entityId ? e.labelIn : e.label,
          flow: e.flow ? 1 : 0,
        },
        classes: [
          e.flow ? "flow" : "rel",
          e.temporalState === "HISTORICAL" ? "hist" : "",
          e.verificationStatus === "DISPUTED" ? "disp" : "",
        ]
          .filter(Boolean)
          .join(" "),
      });
    }
    if (hiddenCount > 0) {
      elements.push({ data: { id: "__more__", label: `+${hiddenCount} muuta`, type: "MORE", center: 0 }, classes: "is-more" });
      elements.push({ data: { id: "__more_e__", source: entityId, target: "__more__" }, classes: "more-edge" });
    }

    const typeStyles: Stylesheet[] = Object.keys(NODE_COLORS).map((t) => ({
      selector: `node.t-${t}`,
      style: { "background-color": nodeColor(t), shape: nodeShape(t) },
    })) as Stylesheet[];

    const style: Stylesheet[] = [
      {
        selector: "node",
        style: {
          "background-color": "#7d8b96",
          width: "mapData(deg, 0, 40, 20, 46)",
          height: "mapData(deg, 0, 40, 20, 46)",
          "border-width": 1,
          "border-color": "#ffffff",
          label: "",
          "font-size": 10,
          color: "#14181d",
          "text-margin-y": 5,
          "text-valign": "bottom",
          "text-halign": "center",
          "text-wrap": "ellipsis",
          "text-max-width": 96,
          "min-zoomed-font-size": 9,
        },
      },
      ...typeStyles,
      { selector: "node.is-center", style: { "background-color": "#14181d", width: 34, height: 34, label: "data(label)", "font-size": 12, "font-weight": "bold", "border-width": 2, "border-color": "#14181d" } },
      { selector: "node.is-more", style: { "background-color": "#ffffff", "border-color": "#8b929c", "border-width": 1, "border-style": "dashed", shape: "round-rectangle", width: 74, height: 22, label: "data(label)", "font-size": 10, color: "#565e68", "text-valign": "center", "text-margin-y": 0 } },
      { selector: "node:selected", style: { "border-width": 3, "border-color": "#0f5ea8", label: "data(label)" } },
      { selector: "node.hl", style: { label: "data(label)", "font-weight": "bold" } },
      { selector: "node.dim", style: { opacity: 0.28 } },
      {
        selector: "edge",
        style: {
          "curve-style": "bezier",
          "target-arrow-shape": "triangle",
          "target-arrow-color": "#b6bcc4",
          "line-color": "#d3d7dd",
          width: 1.2,
          "arrow-scale": 0.75,
          label: "",
          "font-size": 8,
          color: "#565e68",
          "text-background-color": "#faf9f7",
          "text-background-opacity": 0.9,
          "text-background-padding": 2,
          "text-rotation": "autorotate",
        },
      },
      { selector: "edge.flow", style: { "line-color": FLOW_COLOR, "target-arrow-color": FLOW_COLOR, width: 2 } },
      { selector: "edge.hist", style: { "line-style": "dashed", opacity: 0.55 } },
      { selector: "edge.disp", style: { "line-color": "#b4432a", "target-arrow-color": "#b4432a" } },
      { selector: "edge.more-edge", style: { "line-style": "dotted", "line-color": "#c4c9d0", "target-arrow-shape": "none", width: 1 } },
      { selector: "edge.hl", style: { width: 2.4, "line-color": "#0f5ea8", "target-arrow-color": "#0f5ea8", label: "data(label)", "z-index": 20 } },
      { selector: "edge.dim", style: { opacity: 0.12 } },
    ] as Stylesheet[];

    cyRef.current?.destroy();
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style,
      layout:
        depth === 1
          ? { name: "concentric", concentric: (n: NodeSingular) => (n.data("center") ? 10 : n.data("deg") || 1), levelWidth: () => 4, minNodeSpacing: 24, animate: false }
          : { name: "cose", animate: false, nodeRepulsion: () => 9000, idealEdgeLength: () => 95, padding: 24 },
      wheelSensitivity: 0.3,
      minZoom: 0.2,
      maxZoom: 3,
    });
    cyRef.current = cy;

    const clearHl = () => {
      cy.elements().removeClass("hl dim");
      setSelectedNode(null);
    };
    cy.on("tap", (evt) => {
      if (evt.target === cy) clearHl();
    });
    cy.on("tap", "node", (evt) => {
      const node = evt.target as NodeSingular;
      const id = node.id();
      if (id === "__more__") {
        setShowAllNodes(true);
        return;
      }
      if (id === entityId) {
        clearHl();
        return;
      }
      cy.elements().addClass("dim").removeClass("hl");
      const nbrhood = node.closedNeighborhood();
      nbrhood.removeClass("dim").addClass("hl");
      node.connectedEdges().removeClass("dim").addClass("hl");
      setSelectedNode(nodeById.get(id) ?? null);
    });
    cy.on("mouseover", "edge", (evt) => evt.target.addClass("hl"));
    cy.on("mouseout", "edge", (evt) => {
      if (!evt.target.hasClass("hl-lock")) evt.target.removeClass("hl");
    });
    cy.on("dbltap", "node", (evt) => {
      if (evt.target.id() !== entityId && evt.target.id() !== "__more__") setDepth((p) => Math.min(3, p + 1));
    });

    cy.ready(() => cy.fit(undefined, 24));
  }, [data, visibleNodeIds, hiddenCount, activeGroups, showFlows, edgePassesTime, depth, entityId]);

  useEffect(() => {
    render();
  }, [render]);

  const toggleGroup = (k: string) =>
    setActiveGroups((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const selectedEdge = useMemo(() => {
    if (!selectedNode || !data) return null;
    return (
      data.edges.find(
        (e) =>
          (e.source === selectedNode.id && e.target === entityId) ||
          (e.target === selectedNode.id && e.source === entityId),
      ) ?? null
    );
  }, [selectedNode, data, entityId]);

  const typesPresent = useMemo(() => {
    const s = new Set((data?.nodes ?? []).map((n) => n.type));
    return LEGEND.filter((l) => s.has(l.type));
  }, [data]);

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 flex flex-col bg-paper p-4" : ""}>
      {/* toolbar */}
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-1" role="group" aria-label="Aikaväli">
            {TIME_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className="chip"
                data-selected={timeMode === m.id}
                onClick={() => setTimeMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5" role="group" aria-label="Syvyys">
            <span className="text-muted">Syvyys</span>
            {[1, 2, 3].map((d) => (
              <button key={d} type="button" className="chip" data-selected={depth === d} onClick={() => setDepth(d)}>
                {d}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-muted">
            <input type="checkbox" checked={showFlows} onChange={() => setShowFlows((v) => !v)} className="accent-accent" />
            Rahavirrat
          </label>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" className="btn px-2 py-1" onClick={() => cyRef.current?.fit(undefined, 24)} aria-label="Sovita näkymään">Sovita</button>
            <button type="button" className="btn px-2 py-1" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.3)} aria-label="Lähennä">+</button>
            <button type="button" className="btn px-2 py-1" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() / 1.3)} aria-label="Loitonna">−</button>
            <button type="button" className="btn px-2 py-1" onClick={() => setFullscreen((v) => !v)}>
              {fullscreen ? "Sulje" : "Koko näyttö"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(REL_GROUPS).map(([k, g]) => (
            <button key={k} type="button" className="chip" aria-pressed={activeGroups.has(k)} onClick={() => toggleGroup(k)}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1">
        <div
          ref={containerRef}
          className={`cy-container rounded-lg border border-line bg-surface ${fullscreen ? "is-fullscreen" : ""}`}
          role="img"
          aria-label="Verkostokaavio. Sama tieto on saatavilla alla olevana yhteyslistana."
        />
        {loading && (
          <div className="absolute inset-0 grid place-items-center rounded-lg bg-surface/70 text-sm text-muted">
            Ladataan verkostoa…
          </div>
        )}
        {error && (
          <div className="absolute inset-x-4 top-4 rounded-md border border-disputed/30 bg-disputed-soft px-3 py-2 text-sm text-disputed">
            {error} · <button type="button" className="underline" onClick={() => load(depth)}>Yritä uudelleen</button>
          </div>
        )}

        {/* legend */}
        {typesPresent.length > 0 && !loading && (
          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-md border border-line bg-surface/95 px-2.5 py-1.5 text-[11px] text-muted">
            {typesPresent.map((l) => (
              <span key={l.type} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: nodeColor(l.type) }} />
                {l.label}
              </span>
            ))}
            {timeMode !== "current" && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0 w-4 border-t border-dashed border-ink-300" /> historiallinen
              </span>
            )}
          </div>
        )}
      </div>

      <Drawer
        open={selectedNode !== null}
        onClose={() => {
          cyRef.current?.elements().removeClass("hl dim");
          setSelectedNode(null);
        }}
        title={selectedNode?.label ?? ""}
      >
        {selectedNode && (
          <NodeDetail node={selectedNode} edge={selectedEdge} centerLabel={data?.nodes.find((n) => n.id === entityId)?.label ?? "keskussolmu"} />
        )}
      </Drawer>
    </div>
  );
}

function NodeDetail({
  node,
  edge,
  centerLabel,
}: {
  node: GraphNodeData;
  edge: GraphEdgeData | null;
  centerLabel: string;
}) {
  const rel =
    edge && !edge.flow
      ? relationshipPhrase(edge.type as RelationshipType, edge.target === node.id ? "out" : "in")
      : edge?.flow
        ? edge.label
        : null;
  const v = edge ? verificationLabel(edge.verificationStatus) : null;
  return (
    <>
      <dl className="text-sm">
      <Row label="Tyyppi">{typeFi(node.type)}</Row>
      {rel && (
        <Row label={`Suhde kohteeseen ${centerLabel}`}>
          {rel}
          {edge?.role && edge.role.toLowerCase() !== rel.toLowerCase() ? ` · ${edge.role}` : ""}
        </Row>
      )}
      {edge && (
        <Row label="Aikaväli">
          {edge.startDate ? formatDate(edge.startDate) : "?"} – {edge.endDate ? formatDate(edge.endDate) : "nykyhetki"}
          {" "}
          <span className="text-muted">({temporalLabel(edge.temporalState)})</span>
        </Row>
      )}
      {edge?.amount != null && <Row label="Summa">{formatEur(edge.amount)}</Row>}
      {v && (
        <Row label="Varmennus">
          {v.label}
          <p className="mt-0.5 text-[13px] text-muted">{v.description}</p>
        </Row>
      )}
      {edge?.sourceUrl && (
        <Row label="Lähde">
          <a href={edge.sourceUrl} target="_blank" rel="noreferrer" className="text-accent underline">
            {edge.sourceName || "Avaa lähde"}
          </a>
        </Row>
      )}
      </dl>
      <Link href={`/entity/${node.id}`} className="btn-primary mt-4 w-full">
        Avaa profiili
      </Link>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-2.5 last:border-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}

function typeFi(t: string): string {
  const m: Record<string, string> = {
    PERSON: "Henkilö",
    ORGANIZATION: "Organisaatio",
    COMPANY: "Yritys",
    POLITICAL_PARTY: "Puolue",
    GOVERNMENT_BODY: "Julkisyhteisö",
    EDUCATIONAL_INSTITUTION: "Oppilaitos",
    DECISION: "Päätös",
    PROJECT: "Hanke",
    FOUNDATION: "Säätiö",
    ASSOCIATION: "Yhdistys",
    UNION: "Ammattiliitto",
    MEDIA_ORGANIZATION: "Media",
  };
  return m[t] ?? "Toimija";
}
