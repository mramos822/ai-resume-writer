"use client";

import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { ACCENTS, accentIdFor, supportsAccent } from "@/lib/accents";
import { useT } from "@/i18n/provider";

/** The switch that makes the text grow to fill the page when there is little content. It is in "Customize" and also next to the live preview of "Edit". */
export function FillPageSwitch({ fill, onFill, className = "" }: { fill?: boolean; onFill: (on: boolean) => void; className?: string }) {
  const { tr } = useT();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(fill)}
      onClick={() => onFill(!fill)}
      title={tr("With little content the text keeps its natural size. Turn this on to make it fill the page.")}
      className={`flex shrink-0 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent ${className}`}
    >
      <span className={`relative h-4 w-7 rounded-full transition-colors ${fill ? "bg-blue-600" : "bg-muted-foreground/30"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${fill ? "left-3.5" : "left-0.5"}`} />
      </span>
      {tr("Fill the page")}
    </button>
  );
}

/** The colors the chosen look can wear. It shows nothing for the looks that have no color (they are black and white). */
export default function AccentPicker({ template, value, onChange, fill, onFill }: { template: string; value?: string; onChange: (id: string) => void; fill?: boolean; onFill?: (on: boolean) => void }) {
  const { tr } = useT();
  if (!supportsAccent(template) && !onFill) return null;
  const current = accentIdFor(template, value);
  const name = ACCENTS.find((a) => a.id === current)?.name ?? "";
  // a bar docked over the bottom of the preview, as wide as the sheet, like a touch menu: it takes no room from the left column, and it
  // fades to 10% while the pointer is away from the preview
  return (
    <motion.div
      key={template}
      initial={{ y: 14 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto flex w-full items-center gap-3 rounded-b-md border-t bg-card/90 px-4 py-2.5 text-card-foreground opacity-10 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md transition-opacity duration-300 focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
    >
      {supportsAccent(template) && (
        <>
      <span className="w-10 shrink-0 text-xs font-bold">{tr("Color")}</span>
      <div className="grid min-w-0 flex-1 items-center justify-items-center gap-1" style={{ gridTemplateColumns: `repeat(${ACCENTS.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={tr("Color of the look")}>
        {ACCENTS.map((a) => {
          const active = a.id === current;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={tr(a.name)}
              title={tr(a.name)}
              onClick={() => onChange(a.id)}
              style={{ backgroundColor: a.hex }}
              className={`flex aspect-square w-full max-w-8 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-card transition-all hover:scale-110 focus-visible:ring-2 focus-visible:ring-blue-500 ${active ? "scale-110 ring-2 ring-blue-500" : "ring-1 ring-black/10"}`}
            >
              {active && <Check className="h-4 w-4" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
      <span className="hidden w-20 shrink-0 truncate text-right text-xs text-muted-foreground md:block">{tr(name)}</span>
        </>
      )}
      {onFill && <FillPageSwitch fill={fill} onFill={onFill} className="ml-auto" />}
    </motion.div>
  );
}
