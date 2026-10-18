"use client";

// The place filter of the job search: a country (flag and name) and a box that suggests cities and regions of it as you type.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Globe2, MapPin } from "lucide-react";
import "flag-icons/css/flag-icons.min.css";
import { Input } from "@/components/ui/input";
import PickSelect from "@/components/pickSelect";
import { authFetch } from "@/lib/authFetch";
import { SEARCH_COUNTRIES } from "@/lib/jobCountries";
import type { Suggestion } from "@/lib/jobPlaces";
import { REMOTE_PLACE, isRemotePlace } from "@/lib/remotePlace";
import { useT } from "@/i18n/provider";

export default function JobPlacePicker({
  country,
  onCountry,
  value,
  onChange,
  disabled,
  homeCountry,
}: {
  country: string;
  onCountry: (code: string) => void;
  /** what shows in the box and is searched as text */
  value: string;
  onChange: (where: string) => void;
  disabled?: boolean;
  /** the country of the person's profile: it is listed even when the job board does not cover it */
  homeCountry?: string;
}) {
  const { tr, locale } = useT();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const picked = useRef(""); // the text of the suggestion last chosen: it needs no new suggestions
  const covered = SEARCH_COUNTRIES.includes(country.toLowerCase());

  const names = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      return null;
    }
  }, [locale]);
  const nameOf = (code: string) => names?.of(code.toUpperCase()) ?? code.toUpperCase();

  // what is typed is looked up a moment after the last key
  useEffect(() => {
    const typed = value.trim();
    if (!open || !typed || picked.current === typed) {
      setList([]);
      return;
    }
    let off = false;
    const t = setTimeout(() => {
      authFetch(`/api/jobs/places?country=${country.toLowerCase()}&q=${encodeURIComponent(typed)}`)
        .then((r) => (r.ok ? r.json() : { places: [] }))
        .then((d) => {
          if (off) return;
          setList(d.places ?? []);
          setActive(-1);
        })
        .catch(() => !off && setList([]));
    }, 120);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, [open, value, country]);

  // a click outside or Escape closes the list
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  // the countries where there are local jobs (the live board's and our own index's), plus the person's own and the one chosen, by name
  const options = useMemo(() => {
    const codes = new Set([...SEARCH_COUNTRIES, country.toLowerCase()]);
    if (homeCountry) codes.add(homeCountry.toLowerCase());
    return Array.from(codes).sort((a, b) => nameOf(a).localeCompare(nameOf(b), locale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeCountry, country, names, locale]);

  // "Remote" is always offered first when the box is empty or what is typed starts like it, so remote work is a place like any other
  const typedNow = value.trim().toLowerCase();
  const remoteOffered = !isRemotePlace(value) && (typedNow === "" || "remote".startsWith(typedNow) || "remoto".startsWith(typedNow));
  const shown: Suggestion[] = remoteOffered ? [{ label: REMOTE_PLACE, kind: "region" }, ...list] : list;

  const pick = (p: Suggestion) => {
    picked.current = p.label;
    onChange(p.label);
    setList([]);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!shown.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % shown.length : (i - 1 + shown.length) % shown.length));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault(); // choose the suggestion instead of sending the search
      pick(shown[active]);
    }
  };

  return (
    <div ref={box} className="relative grid gap-3 sm:grid-cols-[minmax(0,13rem)_1fr]">
      <PickSelect
        label={tr("Country")}
        value={country.toLowerCase()}
        options={options}
        display={nameOf}
        leading={(c) => <span className={`fi fi-${c} h-4 w-6 rounded-[3px] shadow-sm ring-1 ring-black/10`} aria-hidden />}
        onChange={(c) => {
          onCountry(c.toUpperCase());
          picked.current = "";
          setList([]);
          onChange("");
        }}
      />

      <div className="relative">
        <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => {
            picked.current = "";
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={tr("City or region")}
          className="h-11 pl-10"
          role="combobox"
          aria-label={tr("Location")}
          aria-expanded={open && shown.length > 0}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
        />
        {open && !disabled && shown.length > 0 && (
          <ul role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border bg-popover p-1.5 shadow-lg">
            {shown.map((p, i) => (
              <li key={p.label} role="option" aria-selected={i === active}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${i === active ? "bg-muted" : ""}`}>
                  {p.label === REMOTE_PLACE ? <Globe2 className="h-3.5 w-3.5 shrink-0 text-blue-600" /> : <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  <span className="truncate">{p.label === REMOTE_PLACE ? tr("Remote") : p.label}</span>
                  {p.label === REMOTE_PLACE && <span className="ml-auto text-xs text-muted-foreground">{tr("work from anywhere in {c}", { c: nameOf(country) })}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!covered && open && <p className="mt-1.5 text-xs text-muted-foreground">{tr("We do not have local job listings for {c} yet. You will see remote jobs, and the ones you add with a link.", { c: nameOf(country) })}</p>}
      </div>
    </div>
  );
}
