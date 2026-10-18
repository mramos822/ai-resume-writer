"use client";

import { Flame } from "lucide-react";
import { useT } from "@/i18n/provider";

/** A ribbon across the top left corner of a card (it needs a `relative overflow-hidden` parent): marks the looks people choose most. */
export function PopularRibbon() {
  const { tr } = useT();
  return (
    <span
      aria-label={tr("Popular")}
      className="pointer-events-none absolute left-0 top-0 z-10 h-[4.5rem] w-[4.5rem] overflow-hidden"
    >
      <span className="absolute -left-[1.6rem] top-[0.95rem] flex w-[6.4rem] -rotate-45 items-center justify-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 py-[3px] text-[11px] font-extrabold uppercase tracking-wider text-white shadow-md">
        <Flame className="h-2.5 w-2.5" aria-hidden /> {tr("Popular")}
      </span>
    </span>
  );
}

/** The same mark as a small pill, for lists of names. */
export function PopularPill({ className = "" }: { className?: string }) {
  const { tr } = useT();
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-600 ${className}`}>
      <Flame className="h-2.5 w-2.5" aria-hidden /> {tr("Popular")}
    </span>
  );
}
