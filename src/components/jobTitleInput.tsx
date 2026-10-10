"use client";

import React, { useMemo, useRef, useState } from "react";
import { JOB_TITLES } from "@/lib/jobTitles";
import { Input } from "@/components/ui/input";

/** Text field that suggests common job titles as you type. Anything not in the list can still be typed freely. */
export default function JobTitleInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return JOB_TITLES.slice(0, 8);
    const starts = JOB_TITLES.filter((t) => t.toLowerCase().startsWith(q));
    const words = JOB_TITLES.filter((t) => !t.toLowerCase().startsWith(q) && t.toLowerCase().includes(q));
    return [...starts, ...words].slice(0, 8);
  }, [value]);

  const exact = matches.some((m) => m.toLowerCase() === value.trim().toLowerCase());
  const pick = (t: string) => {
    onChange(t);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div
      ref={wrap}
      className="relative"
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <Input
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, -1));
          } else if (e.key === "Enter" && open && active >= 0) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (matches.length > 0 || value.trim()) && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 no-scrollbar max-h-72 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-lg"
        >
          {matches.map((t, i) => (
            <li key={t} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(t)}
                className={`block w-full px-3 py-2 text-left ${i === active ? "bg-accent" : "hover:bg-accent"}`}
              >
                {t}
              </button>
            </li>
          ))}
          {value.trim() && !exact && (
            <li className="border-t px-3 py-2 text-xs text-muted-foreground">
              {matches.length === 0 ? "Not in our list. " : ""}Press continue to use “{value.trim()}”.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
