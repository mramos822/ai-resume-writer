"use client";

import { useT } from "@/i18n/provider";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fold } from "@/lib/fold";

/**
 * Picker for one option of a list (a country, a state/province/region...): you open the list and choose, or you type a few letters
 * and the list narrows down (accents and capitals do not matter). Custom panel (no native menu, no arrows or scroll buttons);
 * only an option of the list can be kept.
 */
export default function PickSelect({
  value,
  onChange,
  options,
  placeholder = "Choose one",
  label,
  name,
  leading,
  display,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  label: string;
  name?: string;
  /** Something drawn before an option (a flag...), in the field and in the list. */
  leading?: (option: string) => React.ReactNode;
  /** How an option is written for the person (the value stays the same): a country in their language. */
  display?: (option: string) => string;
}) {
  const { tr } = useT();
  const show = (o: string) => (display ? display(o) : o);
  const selected = options.includes(value) ? value : "";
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState(""); // what is being typed to narrow the list
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  // The panel is drawn on <body> and placed next to the field, so the pinned bottom banner (or the end of the page) never
  // covers it or stretches the page. It opens downwards when there is room and upwards when there is not.
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = wrap.current?.getBoundingClientRect();
      if (!r) return;
      const reserve = 96; // the bottom banner
      const below = window.innerHeight - r.bottom - reserve;
      const above = r.top - 72; // the top bar
      const down = below >= 200 || below >= above;
      setPos(
        down
          ? { left: r.left, width: r.width, top: r.bottom + 6, maxH: Math.max(140, Math.min(288, below)) }
          : { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 6, maxH: Math.max(140, Math.min(288, above)) }
      );
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // the options that contain every word typed (in the name shown or in the stored one), the ones that start with it first
  const matches = React.useMemo(() => {
    const q = fold(query);
    if (!q) return options;
    const words = q.split(" ");
    const hit = options.filter((o) => {
      const f = `${fold(show(o))} ${fold(o)}`;
      return words.every((w) => f.includes(w));
    });
    return [...hit.filter((o) => fold(show(o)).startsWith(q)), ...hit.filter((o) => !fold(show(o)).startsWith(q))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, query, display]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const pick = (s: string) => {
    onChange(s);
    close();
  };

  // keep the highlighted row in view when moving with the keyboard
  useEffect(() => {
    if (!open) return;
    (list.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  return (
    <div
      ref={wrap}
      className="relative"
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node)) close();
      }}
    >
      {leading && selected && !query && <span className="pointer-events-none absolute left-3 top-1/2 z-10 flex -translate-y-1/2 items-center">{leading(selected)}</span>}
      <Input
        value={open && query ? query : show(selected)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        placeholder={tr(placeholder)}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label={label}
        autoComplete="off"
        name={name}
        className={`cursor-pointer ${leading && selected && !query ? "pl-11" : ""}`}
        onFocus={(e) => {
          setOpen(true);
          setActive(Math.max(0, options.indexOf(selected)));
          e.currentTarget.select(); // the name that is there is replaced as soon as something is typed
        }}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && matches[active]) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === "Escape") {
            close();
          }
        }}
      />
      {typeof document !== "undefined" &&
        createPortal(
      <AnimatePresence>
        {open && pos && matches.length > 0 && (
          <motion.ul
            ref={list}
            role="listbox"
            initial={{ opacity: 0, y: pos.top !== undefined ? -6 : 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: pos.top !== undefined ? -6 : 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="no-scrollbar overflow-y-auto overscroll-contain rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl"
            style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH, zIndex: 90, transformOrigin: pos.top !== undefined ? "top" : "bottom" }}
          >
            {matches.map((s, i) => (
              <li key={s} role="option" aria-selected={s === selected}>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(s)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    i === active ? "bg-accent" : ""
                  } ${s === selected ? "font-semibold text-blue-500" : ""}`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {leading?.(s)}
                    <span className="truncate">{show(s)}</span>
                  </span>
                  {s === selected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
