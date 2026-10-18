"use client";

// The filters of the job search. The controls go in the SAME row as the tabs (Results, Saved, Applications) and the "Add a job" button, so they take
// no row of their own: the order, a "Filters" button (with how many are on), the filters that are on as small tags that take themselves off with
// one click, and how many jobs are left. The other choices (how recent, level, pay, language) are in a panel that opens below only when asked.
import { ArrowUpDown, SlidersHorizontal, X } from "lucide-react";
import { useT } from "@/i18n/provider";
import { activeFilters, NO_FILTERS, type JobFilters } from "@/lib/jobFilters";

const selectClass = "h-9 w-full rounded-lg border bg-card px-2.5 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function JobFilterControls({ value, onChange, open, onToggle, shown, total }: { value: JobFilters; onChange: (next: JobFilters) => void; open: boolean; onToggle: () => void; shown: number; total: number }) {
  const { tr } = useT();
  const set = <K extends keyof JobFilters>(key: K, v: JobFilters[K]) => onChange({ ...value, [key]: v });
  const active = activeFilters(value);

  // the filters that are on, as tags (each takes itself off)
  const tags: { id: string; label: string; off: () => void }[] = [];
  if (value.posted) tags.push({ id: "posted", label: value.posted === 1 ? tr("Last 24 hours") : tr("Last {n} days", { n: value.posted }), off: () => set("posted", 0) });
  if (value.level !== "any") tags.push({ id: "level", label: value.level === "entry" ? tr("Entry level") : value.level === "mid" ? tr("Mid level") : tr("Senior and above"), off: () => set("level", "any") });
  if (value.pay) tags.push({ id: "pay", label: tr("Pay listed"), off: () => set("pay", false) });
  if (value.lang === "all") tags.push({ id: "lang", label: tr("All languages"), off: () => set("lang", "auto") });

  return (
    <div role="group" aria-label={tr("Filter jobs")} className="flex min-w-0 flex-wrap items-center gap-2">
      <label className="relative inline-flex items-center">
        <ArrowUpDown aria-hidden className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
        <span className="sr-only">{tr("Sort")}</span>
        <select className="h-9 appearance-none rounded-full border bg-card pl-8 pr-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={value.sort} onChange={(e) => set("sort", e.target.value as JobFilters["sort"])}>
          <option value="recent">{tr("Most recent first")}</option>
          <option value="fit">{tr("Best fit first")}</option>
        </select>
      </label>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="job-filters-panel"
        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${open || active > 0 ? "border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-card text-foreground hover:bg-accent"}`}
      >
        <SlidersHorizontal aria-hidden className="h-3.5 w-3.5" />
        {tr("Filters")}
        {active > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white">{active}</span>}
      </button>

      {tags.map((t) => (
        <button key={t.id} type="button" onClick={t.off} aria-label={tr("Remove filter: {name}", { name: t.label })} className="inline-flex h-8 items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-semibold text-foreground hover:bg-accent">
          {t.label}
          <X aria-hidden className="h-3 w-3 text-muted-foreground" />
        </button>
      ))}

      {active > 0 && (
        <span className="text-xs text-muted-foreground" role="status">
          {tr("{n} of {total} jobs", { n: shown, total })}
        </span>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

/** The panel with the other choices: it is rendered by the page, below the row, only while it is open. */
export function JobFilterPanel({ value, onChange, sources = [] }: { value: JobFilters; onChange: (next: JobFilters) => void; sources?: string[] }) {
  const { tr } = useT();
  const set = <K extends keyof JobFilters>(key: K, v: JobFilters[K]) => onChange({ ...value, [key]: v });
  const active = activeFilters(value);
  return (
    <div id="job-filters-panel" className="mb-4 rounded-xl border bg-card p-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Field label={tr("Posted")}>
          <select className={selectClass} value={value.posted} onChange={(e) => set("posted", Number(e.target.value) as JobFilters["posted"])}>
            <option value={0}>{tr("Any time")}</option>
            <option value={1}>{tr("Last 24 hours")}</option>
            <option value={3}>{tr("Last 3 days")}</option>
            <option value={7}>{tr("Last 7 days")}</option>
            <option value={14}>{tr("Last 14 days")}</option>
            <option value={30}>{tr("Last 30 days")}</option>
          </select>
        </Field>
        <Field label={tr("Level")}>
          <select className={selectClass} value={value.level} onChange={(e) => set("level", e.target.value as JobFilters["level"])}>
            <option value="any">{tr("Any level")}</option>
            <option value="entry">{tr("Entry level")}</option>
            <option value="mid">{tr("Mid level")}</option>
            <option value="senior">{tr("Senior and above")}</option>
          </select>
        </Field>
        <Field label={tr("Pay")}>
          <select className={selectClass} value={value.pay ? "listed" : "any"} onChange={(e) => set("pay", e.target.value === "listed")}>
            <option value="any">{tr("Any")}</option>
            <option value="listed">{tr("Pay listed")}</option>
          </select>
        </Field>
        <Field label={tr("Job language")}>
          <select className={selectClass} value={value.lang} onChange={(e) => set("lang", e.target.value as JobFilters["lang"])}>
            <option value="auto">{tr("Same as the app")}</option>
            <option value="all">{tr("All languages")}</option>
          </select>
        </Field>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        {active > 0 ? (
          <button type="button" onClick={() => onChange({ ...NO_FILTERS, sort: value.sort })} className="inline-flex min-h-6 items-center text-sm font-semibold text-blue-500 hover:underline">
            {tr("Clear filters")}
          </button>
        ) : (
          <span />
        )}
        {sources.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {tr("Sources:")} {sources.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
