"use client";

import React from "react";
import { ChevronDown } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const selectClass =
  "h-10 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50";

/** Month + year dropdowns that read and write "YYYY-MM" (empty string when nothing is chosen). */
export default function MonthPicker({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label: string;
}) {
  const [year, month] = /^\d{4}-\d{2}$/.test(value) ? [value.slice(0, 4), value.slice(5)] : ["", ""];
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear + 6 - 1960 }, (_, i) => String(thisYear + 5 - i));

  const update = (nextMonth: string, nextYear: string) => {
    if (!nextMonth && !nextYear) return onChange("");
    // picking only one half fills the other with a sensible default so the value is always complete
    onChange(`${nextYear || String(thisYear)}-${nextMonth || "01"}`);
  };

  const wrap = "relative min-w-0 flex-1";
  const chevron = <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-muted-foreground" />;

  return (
    <div className="flex gap-2">
      <div className={wrap}>
        <select
          aria-label={`${label} month`}
          value={month}
          disabled={disabled}
          onChange={(e) => update(e.target.value, year)}
          className={selectClass}
        >
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </option>
          ))}
        </select>
        {chevron}
      </div>
      <div className={wrap}>
        <select
          aria-label={`${label} year`}
          value={year}
          disabled={disabled}
          onChange={(e) => update(month, e.target.value)}
          className={selectClass}
        >
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {chevron}
      </div>
    </div>
  );
}
