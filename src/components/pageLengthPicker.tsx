"use client";

import React from "react";
import { Check, FileText, Files, Sparkles } from "lucide-react";
import { useT } from "@/i18n/provider";
import { canRunTwoPages, type PageGoal } from "@/lib/pageGoal";

const OPTIONS: { id: PageGoal; title: string; text: string; badge?: string }[] = [
  { id: "one", title: "One page", text: "Short and easy to scan. Best for students and for less than about 10 years of experience.", badge: "Most common" },
  { id: "two", title: "Two pages", text: "For a long career, many projects or publications. Nothing is shrunk to fit." },
  { id: "any", title: "Let Kaizo decide", text: "One page if everything fits comfortably, two if you have a lot to show. Never tiny text." },
];

/** Asks how long the resume should be: one page, two, or it does not matter. The person decides; two pages are only offered by some looks. */
export default function PageLengthPicker({ value, template, onChange, compact = false }: { value: PageGoal; template: string; onChange: (goal: PageGoal) => void; compact?: boolean }) {
  const { tr } = useT();
  const twoOk = canRunTwoPages(template);
  return (
    <div>
      {/* on a phone (compact): the three choices in ONE row, each its own button with its symbol; the cards with their text are for larger screens */}
      {compact && (
        <div role="radiogroup" aria-label={tr("How long should your resume be?")} className="grid grid-cols-3 gap-2 sm:hidden">
          {OPTIONS.map((o) => {
            const active = value === o.id;
            const Icon = o.id === "one" ? FileText : o.id === "two" ? Files : Sparkles;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(o.id)}
                className={`relative flex min-h-[4.75rem] flex-col items-center justify-end gap-1.5 rounded-2xl border px-1.5 pb-2.5 pt-3 text-center transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active ? "border-blue-600 bg-blue-600/10 shadow-sm" : "bg-card hover:border-muted-foreground/40"}`}
              >
                <span className={`absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border transition-colors ${active ? "border-blue-600 bg-blue-600 text-white" : "border-muted-foreground/40"}`}>{active && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}</span>
                <Icon className={`h-6 w-6 ${active ? "text-blue-600" : "text-muted-foreground"}`} strokeWidth={1.75} />
                <span className="text-[13px] font-bold leading-tight">{tr(o.id === "any" ? "Auto" : o.title)}</span>
              </button>
            );
          })}
        </div>
      )}
      <div role="radiogroup" aria-label={tr("How long should your resume be?")} className={`grid gap-3 ${compact ? "max-sm:hidden sm:grid-cols-3" : "sm:grid-cols-3 sm:gap-4"}`}>
        {OPTIONS.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.id)}
              className={`relative rounded-2xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${compact ? "p-3.5" : "p-5"} ${active ? "border-blue-600 bg-blue-600/5 ring-1 ring-blue-600" : "bg-card hover:border-blue-500/60"}`}
            >
              <span className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border ${active ? "border-blue-600 bg-blue-600 text-white" : "border-muted-foreground/40"}`}>{active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
              <p className={`pr-7 font-bold ${compact ? "text-sm" : "text-lg"}`}>{tr(o.title)}</p>
              {o.badge && <span className="mt-1 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">{tr(o.badge)}</span>}
              <p className={`mt-1.5 text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>{tr(o.text)}</p>
            </button>
          );
        })}
      </div>
      {value !== "one" && !twoOk && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">{tr("This look is always one page. Pick a one-column look, such as Classic, ATS, Executive or Minimal, to use two pages.")}</p>
      )}
    </div>
  );
}
