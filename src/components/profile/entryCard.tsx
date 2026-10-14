"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronDown, MapPin, Trash2 } from "lucide-react";
import { useT } from "@/i18n/provider";

/**
 * One stop of a timeline (a job, a school): a card on the line, with the title and who at the top, the dates as a small chip and the
 * place under them. A stop that is still going (a current job, a school you attend) has a filled, softly pulsing dot.
 * The card is a fold, like the ones of Projects: the header never changes and only the part below it opens and closes (height and
 * fade, one single motion), showing `children` (the form to edit it). The remove button shows when you point at the card (always on
 * touch screens).
 */
export default function EntryCard({
  index = 0,
  when,
  where,
  title,
  subtitle,
  note,
  current = false,
  open = false,
  onToggle,
  onDelete,
  children,
}: {
  index?: number;
  when: string;
  where?: string;
  title: string;
  subtitle?: string;
  /** one short line under the place (the GPA of a school) */
  note?: string;
  /** still going: the dot is filled and pulses */
  current?: boolean;
  /** the fold is open: `children` show under the header */
  open?: boolean;
  onToggle: () => void;
  onDelete: () => void;
  children?: React.ReactNode;
}) {
  const { tr } = useT();
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
    >
      {/* the dot on the line */}
      <span className="absolute -left-[1.99rem] top-4 flex h-3.5 w-3.5 items-center justify-center" aria-hidden>
        {current && <span className="absolute h-full w-full animate-ping rounded-full bg-blue-500/40" />}
        <span className={`relative h-3.5 w-3.5 rounded-full border-2 border-blue-500 ring-4 ring-background transition-colors duration-300 ${current || open ? "bg-blue-500" : "bg-background"}`} />
      </span>

      <div className={`overflow-hidden rounded-xl border bg-card transition-shadow duration-300 ${open ? "shadow-md ring-1 ring-blue-500/30" : "hover:shadow-sm"}`}>
        <div className="flex items-center pr-2">
          <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-w-0 flex-1 items-start justify-between gap-3 px-4 py-3 text-left">
            <span className="min-w-0">
              <span className="block truncate text-base font-bold leading-snug">{tr(title)}</span>
              {subtitle && <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>}
              {(where || note) && (
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  {where && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {where}
                    </span>
                  )}
                  {note && <span className="truncate">{note}</span>}
                </span>
              )}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <CalendarDays className="h-3.5 w-3.5" />
              {when}
            </span>
          </button>
          <button onClick={onDelete} aria-label={tr("Remove {title}", { title })} className="rounded-full p-1.5 text-muted-foreground opacity-100 transition-all hover:bg-red-500/10 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" tabIndex={-1} aria-hidden onClick={onToggle} className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div className="border-t bg-muted/20 px-4 py-5">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}
