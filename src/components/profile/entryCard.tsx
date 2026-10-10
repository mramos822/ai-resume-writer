"use client";

import React from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2 } from "lucide-react";

/**
 * One entry of a timeline (a job, a school): when and where on the left, what and who on the right.
 * The edit and remove buttons show when you point at it (always on touch screens).
 */
export default function EntryCard({
  index = 0,
  when,
  where,
  title,
  subtitle,
  note,
  bullets,
  onEdit,
  onDelete,
}: {
  index?: number;
  when: string;
  where?: string;
  title: string;
  subtitle?: string;
  note?: string;
  bullets?: string[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="group relative grid gap-x-8 gap-y-1 pb-8 pl-7 last:pb-0 sm:grid-cols-[9.5rem_1fr]"
    >
      {/* the dot on the timeline line */}
      <span className="absolute left-0 top-1.5 h-3 w-3 -translate-x-[calc(50%+0.5px)] rounded-full border-2 border-blue-500 bg-background" aria-hidden />
      <div className="text-sm text-muted-foreground sm:pt-0.5">
        <p className="font-medium text-foreground/80">{when}</p>
        {where && <p>{where}</p>}
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold leading-snug">{title}</h3>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <button onClick={onEdit} aria-label={`Edit ${title}`} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-blue-500/10 hover:text-blue-500">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={onDelete} aria-label={`Remove ${title}`} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {note && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{note}</p>}
        {bullets && bullets.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.li>
  );
}
