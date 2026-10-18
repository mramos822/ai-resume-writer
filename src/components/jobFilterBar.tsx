"use client";

// The filters of the job search: order, how recent, level, pay and language. The person chooses; the list says how many jobs are left.
import { useT } from "@/i18n/provider";
import { activeFilters, NO_FILTERS, type JobFilters } from "@/lib/jobFilters";

const selectClass = "h-10 w-full rounded-lg border bg-card px-3 text-sm font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

export default function JobFilterBar({ value, onChange, shown, total }: { value: JobFilters; onChange: (next: JobFilters) => void; shown: number; total: number }) {
  const { tr } = useT();
  const set = <K extends keyof JobFilters>(key: K, v: JobFilters[K]) => onChange({ ...value, [key]: v });
  const active = activeFilters(value);
  return (
    <section aria-label={tr("Filter jobs")} className="mb-5 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Field label={tr("Sort")}>
          <select className={selectClass} value={value.sort} onChange={(e) => set("sort", e.target.value as JobFilters["sort"])}>
            <option value="recent">{tr("Most recent first")}</option>
            <option value="fit">{tr("Best fit first")}</option>
          </select>
        </Field>
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
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground" role="status">
          {active > 0 ? tr("{n} of {total} jobs", { n: shown, total }) : tr("{n} jobs", { n: total })}
        </p>
        {active > 0 && (
          <button type="button" onClick={() => onChange({ ...NO_FILTERS, sort: value.sort })} className="inline-flex min-h-6 items-center font-semibold text-blue-500 hover:underline">
            {tr("Clear filters")}
          </button>
        )}
      </div>
    </section>
  );
}
