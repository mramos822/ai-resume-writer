"use client";

import React from "react";
import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";

interface PageHeaderProps {
  title: string;
  /** One friendly sentence saying what this page is for. */
  subtitle: string;
  /** Optional short "what to do here" tip shown as a note under the title. */
  tip?: string;
  actions?: React.ReactNode;
}

/** Same top block on every page so people always know where they are and what to do. */
export default function PageHeader({ title, subtitle, tip, actions }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 flex flex-wrap items-end justify-between gap-4"
    >
      <div className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-1.5 text-base text-muted-foreground">{subtitle}</p>
        {tip && (
          <p className="mt-3 inline-flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
            {tip}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
