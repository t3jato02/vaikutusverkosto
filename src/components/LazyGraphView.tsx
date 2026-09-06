"use client";

import dynamic from "next/dynamic";

// Cytoscape (~110 kB gzip) is split into its own chunk and only fetched on
// pages that actually render a graph, after the page shell + accessible
// relationship list are interactive.
const GraphView = dynamic(() => import("@/components/GraphView"), {
  ssr: false,
  loading: () => (
    <div className="space-y-3">
      <div className="skeleton h-8 w-full" />
      <div className="skeleton h-[440px] w-full rounded-lg sm:h-[560px]" />
    </div>
  ),
});

export default function LazyGraphView({ entityId }: { entityId: string }) {
  return <GraphView entityId={entityId} />;
}
