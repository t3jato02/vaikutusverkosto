"use client";

import { useEffect, useState } from "react";
import Drawer from "@/components/Drawer";

/**
 * Responsive filter container. On >= 640px the children render inline. Below
 * that they collapse behind a "Suodattimet (N)" button that opens a bottom
 * sheet. Children are rendered in exactly one place (no duplicate ids / form
 * fields).
 */
export default function FilterBar({
  activeCount,
  children,
  title = "Suodattimet",
}: {
  activeCount: number;
  children: React.ReactNode;
  title?: string;
}) {
  const [isNarrow, setIsNarrow] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!isNarrow) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn w-full justify-between"
        aria-haspopup="dialog"
      >
        <span className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          {title}
        </span>
        {activeCount > 0 && (
          <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-white">{activeCount}</span>
        )}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </Drawer>
    </>
  );
}
