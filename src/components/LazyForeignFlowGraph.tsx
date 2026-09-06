"use client";

import dynamic from "next/dynamic";

const ForeignFlowGraph = dynamic(() => import("@/components/ForeignFlowGraph"), {
  ssr: false,
  loading: () => <div className="skeleton h-[440px] w-full rounded-lg" />,
});

export default function LazyForeignFlowGraph({ query }: { query: string }) {
  return <ForeignFlowGraph query={query} />;
}
