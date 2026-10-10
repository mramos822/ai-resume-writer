"use client";

import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { LANGUAGES, POPULAR_LANGUAGES, type LanguageEntry } from "@/lib/languages";
import SuggestInput from "@/components/suggestInput";
import { Button } from "@/components/ui/button";

// five dots, weakest to strongest: tapping the 4th means Fluent, and every dot to its left lights up with it
const LEVELS_ASC = ["Basic", "Intermediate", "Advanced", "Fluent", "Native"];

function LevelDots({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [hover, setHover] = useState(0);
  const current = LEVELS_ASC.indexOf(value) + 1;
  const shown = hover || current;
  return (
    <span className="flex items-center gap-3">
      <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">{shown ? LEVELS_ASC[shown - 1] : "Not set"}</span>
      <span className="flex items-center gap-1.5" role="group" aria-label={label} onMouseLeave={() => setHover(0)}>
        {LEVELS_ASC.map((lvl, i) => {
          const n = i + 1;
          return (
            <button
              key={lvl}
              type="button"
              aria-label={`${label}: ${lvl}`}
              aria-pressed={current === n}
              title={lvl}
              onClick={() => onChange(lvl)}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
              className={`h-4 w-4 rounded-full border-2 transition-all duration-150 ${
                n <= shown ? (hover ? "scale-110 border-blue-400 bg-blue-400" : "border-blue-600 bg-blue-600") : "border-border bg-transparent"
              }`}
            />
          );
        })}
      </span>
    </span>
  );
}

/** Languages the person speaks, each with a proficiency level. */
export default function LanguagePicker({
  languages,
  onChange,
  hideTitle = false,
}: {
  languages: LanguageEntry[];
  onChange: (list: LanguageEntry[]) => void;
  hideTitle?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [level, setLevel] = useState<string>("Fluent");
  const taken = new Set(languages.map((l) => l.name.toLowerCase()));

  const add = (name: string, lvl = level) => {
    const n = name.trim();
    if (!n || taken.has(n.toLowerCase())) return;
    onChange([...languages, { name: n, level: lvl }]);
    setDraft("");
  };

  return (
    <div>
      {!hideTitle && (
        <p className="mb-1.5 text-sm font-semibold">
          Languages you speak <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
      )}
      <div
        className="flex flex-wrap items-start gap-2"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.defaultPrevented && draft.trim()) {
            e.preventDefault();
            add(draft);
          }
        }}
      >
        <div className="min-w-[14rem] flex-1">
          <SuggestInput value={draft} onChange={setDraft} options={LANGUAGES} placeholder="Start typing, e.g. Spanish" />
        </div>
        <LevelDots value={level} onChange={setLevel} label="Level for the new language" />
        <Button type="button" variant="outline" onClick={() => add(draft)} disabled={!draft.trim()} className="h-10 gap-1">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {languages.length > 0 && (
        <ul className="mt-3 space-y-2">
          {languages.map((l) => (
            <li key={l.name} className="flex items-center gap-2 rounded-lg border bg-card py-1.5 pl-3 pr-1.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.name}</span>
              <LevelDots
                value={l.level}
                label={`Level of ${l.name}`}
                onChange={(v) => onChange(languages.map((x) => (x.name === l.name ? { ...x, level: v } : x)))}
              />
              <button
                type="button"
                aria-label={`Remove ${l.name}`}
                onClick={() => onChange(languages.filter((x) => x.name !== l.name))}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ul className="mt-3 flex flex-wrap gap-2">
        {POPULAR_LANGUAGES.filter((n) => !taken.has(n.toLowerCase())).map((n) => (
          <li key={n}>
            <button
              type="button"
              onClick={() => add(n, "Fluent")}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-blue-500 hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> {n}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
