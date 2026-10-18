"use client";

import React, { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { asResumeLang } from "@/lib/dateFormat";
import { useT } from "@/i18n/provider";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const PAGE = 12; // years on a page of the year view

const show = (v: string) => (/^\d{4}-\d{2}$/.test(v) ? `${v.slice(5)}/${v.slice(0, 4)}` : "");

/**
 * A date field for month and year that reads and writes "YYYY-MM" (empty string when nothing is chosen). It can be typed ("02/2030")
 * or picked in a small calendar of the page: the arrows change the year, a tap on the year opens a grid of years to jump far, and the
 * months are a grid of twelve.
 * Only dates that can exist are offered: nothing after this month, unless `allowFuture` (an expected graduation), and nothing
 * before `min` (the start date, for an end date).
 */
export default function MonthPicker({
  value,
  onChange,
  disabled,
  label,
  allowFuture,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label: string;
  /** also offer the coming years (up to 8), for things that have not happened yet like an expected graduation */
  allowFuture?: boolean;
  /** "YYYY-MM": nothing earlier than this is offered */
  min?: string;
}) {
  const { tr, locale } = useT();
  const names = asResumeLang(locale) === "es" ? MONTHS_ES : MONTHS_EN;
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const top = allowFuture ? thisYear + 8 : thisYear;
  const hasMin = /^\d{4}-\d{2}$/.test(min ?? "");
  const minYear = hasMin ? Number(min!.slice(0, 4)) : 1960;
  const minMonth = hasMin ? Number(min!.slice(5)) : 1;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"months" | "years">("months");
  const chosenYear = /^\d{4}-\d{2}$/.test(value) ? Number(value.slice(0, 4)) : 0;
  const chosenMonth = /^\d{4}-\d{2}$/.test(value) ? Number(value.slice(5)) : 0;
  const [year, setYear] = useState(chosenYear || Math.min(thisYear, top));
  const [yearsFrom, setYearsFrom] = useState(0);
  const [draft, setDraft] = useState<string | null>(null); // what is being typed; null = show the value
  const input = useRef<HTMLInputElement>(null);

  // the calendar opens on the year of the date (or this year)
  useEffect(() => {
    if (open) {
      setYear(Math.min(Math.max(chosenYear || Math.min(thisYear, top), minYear), top));
      setView("months");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Whether a month of a year can exist (not in the future, not before the start). */
  const allowed = (y: number, m: number) => {
    if (y < minYear || y > top) return false;
    if (y === minYear && m < minMonth) return false;
    if (!allowFuture && (y > thisYear || (y === thisYear && m > thisMonth))) return false;
    return true;
  };
  const pick = (y: number, m: number) => {
    if (!allowed(y, m)) return;
    onChange(`${y}-${String(m).padStart(2, "0")}`);
    setDraft(null);
    setOpen(false);
  };

  const type = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    const text = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    setDraft(text);
    if (!text) return onChange("");
    const m = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(text);
    if (m && allowed(Number(m[2]), Number(m[1]))) {
      onChange(`${m[2]}-${m[1]}`);
      setYear(Number(m[2]));
    }
  };

  const arrow = "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30";
  const first = yearsFrom || Math.max(minYear, Math.min(year, top) - 4);
  const yearList = Array.from({ length: PAGE }, (_, i) => first + i).filter((y) => y >= minYear && y <= top);

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={`relative ${disabled ? "opacity-50" : ""}`}>
          <input
            ref={input}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            aria-label={label}
            placeholder={tr("MM/YYYY")}
            value={draft ?? show(value)}
            onFocus={() => setOpen(true)}
            onChange={(e) => type(e.target.value)}
            onBlur={() => setDraft(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape" || e.key === "Enter") {
                e.preventDefault();
                setOpen(false);
              }
            }}
            className="h-10 w-full rounded-md border border-input bg-background pl-3 pr-10 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label={tr("Open the calendar")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setOpen((o) => !o);
              input.current?.focus();
            }}
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[17rem] p-3"
        onOpenAutoFocus={(e) => e.preventDefault()} // the cursor stays in the field, so typing keeps working
        onInteractOutside={(e) => {
          if (input.current && e.target instanceof Node && input.current.parentElement?.contains(e.target)) e.preventDefault();
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <button type="button" className={arrow} aria-label={view === "months" ? tr("Previous year") : tr("Previous years")} disabled={view === "months" ? year <= minYear : first <= minYear} onClick={() => (view === "months" ? setYear((y) => y - 1) : setYearsFrom(Math.max(minYear, first - PAGE)))}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => { setView((v) => (v === "months" ? "years" : "months")); setYearsFrom(0); }} className="rounded-md px-3 py-1 text-sm font-extrabold transition-colors hover:bg-accent">
            {view === "months" ? year : `${yearList[0] ?? year} – ${yearList[yearList.length - 1] ?? year}`}
          </button>
          <button type="button" className={arrow} aria-label={view === "months" ? tr("Next year") : tr("Next years")} disabled={view === "months" ? year >= top : first + PAGE > top} onClick={() => (view === "months" ? setYear((y) => y + 1) : setYearsFrom(first + PAGE))}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {view === "months" ? (
          <div className="grid grid-cols-3 gap-1.5">
            {names.map((n, i) => {
              const m = i + 1;
              const on = year === chosenYear && m === chosenMonth;
              const ok = allowed(year, m);
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!ok}
                  aria-pressed={on}
                  onClick={() => pick(year, m)}
                  className={`h-10 rounded-md text-sm font-medium transition-colors ${on ? "bg-blue-600 font-bold text-white" : "hover:bg-accent"} disabled:pointer-events-none disabled:opacity-30`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {yearList.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => {
                  setYear(y);
                  setView("months");
                }}
                className={`h-10 rounded-md text-sm font-medium transition-colors ${y === chosenYear ? "bg-blue-600 font-bold text-white" : y === year ? "bg-accent" : "hover:bg-accent"}`}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setDraft(null);
              setOpen(false);
            }}
            className="mt-2 w-full rounded-md py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {tr("Clear")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
