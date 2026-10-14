"use client";

import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { JOB_TITLES } from "@/lib/jobTitles";
import { fold } from "@/lib/fold";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/provider";

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
  const { tr } = useT();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // the person wrote something in this field: only then does the list say "not in our list"
  const [typed, setTyped] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const titles = useMemo(() => JOB_TITLES.map((t) => tr(t)), [tr]);
  const matches = useMemo(() => {
    const q = fold(value);
    if (!q) return titles.slice(0, 8);
    const starts = titles.filter((t) => fold(t).startsWith(q));
    const words = titles.filter((t) => !fold(t).startsWith(q) && fold(t).includes(q));
    return [...starts, ...words].slice(0, 8);
  }, [value, titles]);

  const exact = matches.some((m) => m.toLowerCase() === value.trim().toLowerCase());
  const pick = (t: string) => {
    onChange(t);
    setOpen(false);
    setActive(-1);
    setTyped(false);
  };

  return (
    <div
      ref={wrap}
      className="relative"
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node)) {
          setOpen(false);
          setTyped(false);
        }
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
        // the list is not opened by just landing on the field (when a form opens it takes the focus): it opens with a click, with typing or with the arrows
        onClick={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setTyped(true);
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
      <AnimatePresence>
      {open && (matches.length > 0 || (typed && value.trim())) && (
        <motion.ul
          key="list"
          role="listbox"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "top" }}
          className="absolute z-20 mt-1 no-scrollbar max-h-72 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-lg"
        >
          {matches.map((t, i) => (
            <li key={t} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(t)}
                className={`block w-full px-3 py-2 text-left transition-colors ${i === active ? "bg-accent" : "hover:bg-accent"}`}
              >
                {tr(t)}
              </button>
            </li>
          ))}
          {typed && value.trim() && !exact && (
            <li className="border-t px-3 py-2 text-xs text-muted-foreground">
              {matches.length === 0 ? tr("Not in our list. ") : ""}{tr("Press continue to use “")}{value.trim()}”.
            </li>
          )}
        </motion.ul>
      )}
      </AnimatePresence>
    </div>
  );
}
