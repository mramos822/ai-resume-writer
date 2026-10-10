"use client";

import React, { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Text field that suggests entries from a list while you type (best matches first).
 * Anything that is not in the list can still be typed freely.
 */
export default function SuggestInput({
  value,
  onChange,
  options,
  placeholder,
  autoFocus,
  max = 8,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  autoFocus?: boolean;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    // every word typed has to appear, so "ut austin" finds "University of Texas at Austin"-style names too
    const words = q.split(/\s+/);
    const hit = options.filter((o) => {
      const l = o.toLowerCase();
      return words.every((w) => l.includes(w));
    });
    const starts = hit.filter((o) => o.toLowerCase().startsWith(q));
    const rest = hit.filter((o) => !o.toLowerCase().startsWith(q));
    return [...starts, ...rest].slice(0, max);
  }, [value, options, max]);

  const pick = (o: string) => {
    onChange(o);
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
      {open && matches.length > 0 && (
        <ul role="listbox" className="absolute z-20 mt-1 no-scrollbar max-h-72 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-lg">
          {matches.map((o, i) => (
            <li key={o} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                className={`block w-full px-3 py-2 text-left ${i === active ? "bg-accent" : "hover:bg-accent"}`}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
