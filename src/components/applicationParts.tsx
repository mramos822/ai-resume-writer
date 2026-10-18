"use client";

// Small pieces shared by the pages that prepare an application.
import React from "react";
import { Check, X } from "lucide-react";
import { useT } from "@/i18n/provider";

/** A score from 0 to 100 as a ring. */
export function Ring({ value, size = 84, loading = false }: { value: number; size?: number; loading?: boolean }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const color = value >= 70 ? "#22c55e" : value >= 40 ? "#3b82f6" : "#f59e0b";
  // while the number is being worked out the ring only spins (no number yet); when it is ready the ring fills from empty to it
  const [shown, setShown] = React.useState(loading ? 0 : value);
  React.useEffect(() => {
    if (loading) {
      setShown(0);
      return;
    }
    const t = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(t);
  }, [loading, value]);
  const v = Math.max(0, Math.min(100, loading ? 0 : shown));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role={loading ? "progressbar" : undefined} aria-busy={loading || undefined}>
      <svg viewBox="0 0 100 100" className={`h-full w-full -rotate-90 ${loading ? "animate-spin" : ""}`} style={loading ? { animationDuration: "1.1s" } : undefined}>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-border" />
        {loading ? (
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" stroke="#3b82f6" strokeDasharray={c} strokeDashoffset={c * 0.75} />
        ) : (
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" stroke={color} strokeDasharray={c} strokeDashoffset={c - (c * v) / 100} style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)" }} />
        )}
      </svg>
      {!loading && <span className="absolute inset-0 flex items-center justify-center text-xl font-black tabular-nums">{value}</span>}
    </div>
  );
}

/** Yes / No buttons. */
export function YesNo({ value, onChange, label }: { value: boolean | null; onChange: (v: boolean) => void; label: string }) {
  const { tr } = useT();
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 gap-1.5">
      {([true, false] as const).map((v) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${value === v ? (v ? "border-green-600 bg-green-600 text-white" : "border-slate-500 bg-slate-500 text-white") : "text-muted-foreground hover:border-blue-500 hover:text-foreground"}`}
        >
          {value === v && (v ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" strokeWidth={3} />)}
          {v ? tr("Yes") : tr("No")}
        </button>
      ))}
    </div>
  );
}
