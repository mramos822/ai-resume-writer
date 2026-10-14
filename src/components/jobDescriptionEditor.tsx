"use client";

import React, { useMemo, useRef, useState } from "react";
import { Lightbulb, Plus, Check, ChevronDown } from "lucide-react";
import { ACTION_VERBS, bulletTips, normalizeBullets, toBullets } from "@/lib/bullets";
import { ideasFor } from "@/lib/jobIdeas";
import { useT } from "@/i18n/provider";

const RECOMMENDED_MAX = 700;

/**
 * Bulleted "what did you do" editor: every line becomes a bullet, Enter starts a new one,
 * with a character counter, live tips and example bullets picked from the job title.
 */
export default function JobDescriptionEditor({
  value,
  onChange,
  jobTitle,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  jobTitle: string;
  /** a shorter box, with the tips, the examples and the verbs folded until asked for (used where space is tight) */
  compact?: boolean;
}) {
  const { tr } = useT();
  const [helpOpen, setHelpOpen] = useState(false);
  const showHelp = !compact || helpOpen;
  const ref = useRef<HTMLTextAreaElement>(null);
  const bullets = useMemo(() => toBullets(value), [value]);
  const tips = useMemo(() => bulletTips(bullets), [bullets]);
  const ideas = useMemo(() => ideasFor(jobTitle, tr), [jobTitle, tr]);
  const chars = bullets.join("").length;
  const used = new Set(bullets.map((b) => b.toLowerCase()));

  const setValue = (next: string, caret?: number) => {
    onChange(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const pos = caret ?? next.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const addLine = (text: string) => {
    const base = value.trimEnd();
    const sep = base ? "\n" : "";
    setValue(normalizeBullets(`${base}${sep}${text}`), undefined);
    ref.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const pos = el.selectionStart;
    const collapsed = el.selectionStart === el.selectionEnd;
    const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
    const nl = value.indexOf("\n", pos);
    const lineEnd = nl === -1 ? value.length : nl;
    const line = value.slice(lineStart, lineEnd);
    const emptyBullet = line.replace(/^[•\s]+$/, "") === "" && line.includes("•");

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (emptyBullet) {
        // Enter on an empty bullet ends the list
        removeLine(lineStart, lineEnd);
        return;
      }
      setValue(`${value.slice(0, pos)}\n• ${value.slice(pos)}`, pos + 3);
      return;
    }

    if (e.key === "Backspace" && collapsed) {
      // an empty bullet disappears entirely
      if (emptyBullet) {
        e.preventDefault();
        removeLine(lineStart, lineEnd);
        return;
      }
      // caret right after the "• ": merge this bullet into the one above (or just ignore on the first line)
      if (pos - lineStart <= 2 && /^•\s?/.test(line)) {
        e.preventDefault();
        if (lineStart === 0) return;
        const markerLen = line.match(/^•\s?/)![0].length;
        setValue(value.slice(0, lineStart - 1) + value.slice(lineStart + markerLen), lineStart - 1);
      }
      return;
    }

    if (e.key === "Delete" && collapsed && pos === lineEnd && nl !== -1) {
      // Delete at the end of a line pulls the next bullet up, without leaving its "• " behind
      e.preventDefault();
      const next = value.slice(nl + 1);
      const markerLen = (next.match(/^•\s?/) ?? [""])[0].length;
      setValue(value.slice(0, nl) + next.slice(markerLen), pos);
    }
  };

  /** Removes a whole line, including one newline, so no empty bullet is left behind. */
  const removeLine = (lineStart: number, lineEnd: number) => {
    let from = lineStart;
    let to = lineEnd;
    if (from > 0) from -= 1; // the newline before it
    else if (to < value.length) to += 1; // first line: the newline after it
    const next = value.slice(0, from) + value.slice(to);
    const caret = Math.max(0, from === lineStart ? from : from);
    setValue(next.trim() === "" || next.trim() === "•" ? "" : next, Math.min(caret, next.length));
  };

  const countTone = chars === 0 ? "text-muted-foreground" : chars > RECOMMENDED_MAX ? "text-amber-500" : chars >= 120 ? "text-green-500" : "text-muted-foreground";

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-semibold">{tr("What did you do?")}</span>
        <span className={`text-xs tabular-nums ${countTone}`}>
          {chars} / {RECOMMENDED_MAX}{" "}{tr("characters ·")}{" "}{bullets.length}{" "}{tr("bullet")}{bullets.length === 1 ? "" : tr("s")}
        </span>
      </div>

      <textarea
        ref={ref}
        value={value}
        rows={compact ? 4 : 8}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          const raw = e.target.value;
          const next = normalizeBullets(raw);
          setValue(next, e.target.selectionStart + (next.length - raw.length));
        }}
        placeholder={tr("• Served 100+ customers per shift\n• Trained 3 new team members\n• Kept the station clean during rush hours")}
        className={`no-scrollbar ${compact ? "min-h-[6.5rem]" : "min-h-[11rem]"} w-full resize-y rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground/70 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20`}
      />
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-border">
        <div
          className={`h-full transition-all duration-300 ${chars > RECOMMENDED_MAX ? "bg-amber-500" : "bg-blue-600"}`}
          style={{ width: `${Math.min(100, (chars / RECOMMENDED_MAX) * 100)}%` }}
        />
      </div>

      {compact && (
        <button type="button" aria-expanded={helpOpen} onClick={() => setHelpOpen((v) => !v)} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline">
          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${helpOpen ? "rotate-180" : ""}`} />
          {tr("Tips, ideas and strong verbs")}
        </button>
      )}
      {showHelp && (
      <>
      <ul className="mt-3 space-y-1.5">
        {tips.map((t) => (
          <li key={t.text} className="flex items-start gap-2 text-xs text-muted-foreground">
            {t.tone === "good" ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
            ) : (
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
            )}
            {tr(t.text)}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {jobTitle.trim() ? tr("Ideas for {v0}", { v0: jobTitle.trim() }) : tr("Ideas to start from")} <span className="font-normal normal-case">{tr("(tap to add, then make it yours)")}</span>
        </p>
        <ul className="flex flex-wrap gap-2">
          {ideas
            .filter((i) => !used.has(i.toLowerCase()))
            .slice(0, 4)
            .map((idea) => (
              <li key={idea}>
                <button
                  type="button"
                  onClick={() => addLine(idea)}
                  className="inline-flex items-start gap-1 rounded-lg border border-dashed px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-blue-500 hover:bg-accent hover:text-foreground"
                >
                  <Plus className="mt-0.5 h-3 w-3 shrink-0" /> {idea}
                </button>
              </li>
            ))}
        </ul>
        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr("Strong verbs to start a bullet")}</p>
        <ul className="flex flex-wrap gap-1.5">
          {ACTION_VERBS.map((v) => (
            <li key={v}>
              <button
                type="button"
                onClick={() => addLine(`${tr(v)} `)}
                className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {tr(v)}
              </button>
            </li>
          ))}
        </ul>
      </div>
      </>
      )}
    </div>
  );
}
