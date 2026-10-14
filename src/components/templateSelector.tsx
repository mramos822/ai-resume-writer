"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { loadTemplates } from "@/lib/templatePreload";
import { useT } from "@/i18n/provider";
import { usePopularTemplates } from "@/lib/usePopularTemplates";
import { PopularRibbon } from "@/components/popularRibbon";

interface Template {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

interface TemplateSelectorProps {
  onTemplateSelect: (templateId: string) => void;
  /** Big previews, only the name under each one, and the description of the chosen look slides in below. */
  showcase?: boolean;
}

export default function TemplateSelector({ onTemplateSelect, showcase = false }: TemplateSelectorProps) {
  const isPopular = usePopularTemplates(); // the three looks with the most resumes
  const { tr } = useT();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadTemplates()
      .then((data) => {
        if (!alive) return;
        setTemplates(data);
        if (data.length > 0) {
          let saved: string | null = null;
          try {
            saved = localStorage.getItem("kaizo_template");
          } catch {
            /* ignore */
          }
          const defaultTemplate = data.find((t) => t.id === saved)?.id ?? data[0].id;
          setSelectedTemplate(defaultTemplate);
          onTemplateSelect(defaultTemplate);
        }
      })
      .catch(console.error);
    return () => {
      alive = false;
    };
  }, [onTemplateSelect]);

  const handleSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    onTemplateSelect(templateId);
  };

  const short = (name: string) => tr(name.replace(" (Default)", ""));

  if (showcase) {
    // The sheets are fully loaded before this renders (see lib/templatePreload), so they just animate in: no placeholder
    if (templates.length === 0) {
      return (
        <div className="grid grid-cols-2 items-start gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-5" aria-busy aria-label={tr("Resume template")}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="shimmer aspect-[600/840] w-full rounded-lg bg-muted" />
              <div className="shimmer mt-3 h-3 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="relative">
        <div className="grid grid-cols-2 items-start gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-5" role="radiogroup" aria-label={tr("Resume template")}>
          {templates.map((template, i) => {
            const active = selectedTemplate === template.id;
            return (
              <motion.div
                key={template.id}
                className="flex flex-col items-center"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.03 + Math.min(i, 9) * 0.04, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handleSelect(template.id)}
                  className={`group relative w-full overflow-hidden rounded-lg bg-white p-1 transition-all duration-300 ease-out ${
                    active
                      ? "-translate-y-1 shadow-[0_18px_36px_-14px_rgba(37,99,235,0.55)] ring-2 ring-blue-600 ring-offset-2 ring-offset-background"
                      : "shadow-[0_6px_16px_-8px_rgba(0,0,0,0.45)] ring-1 ring-black/10 hover:-translate-y-1 hover:shadow-[0_14px_28px_-12px_rgba(0,0,0,0.5)]"
                  }`}
                >
                  {isPopular(template.id) && <PopularRibbon />}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={template.imageUrl} alt={tr("{v0} preview", { v0: short(template.name) })} width={600} height={840} decoding="sync" className="h-auto w-full rounded-[3px]" />
                  {active && (
                    <motion.span
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 420, damping: 24 }}
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </motion.span>
                  )}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => handleSelect(template.id)}
                  className={`mt-3 text-sm font-semibold tracking-wide transition-colors ${active ? "text-blue-600" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {short(template.name)}
                </button>
                <p className={`mt-0.5 hidden max-w-[14rem] text-center text-[11px] leading-snug text-muted-foreground transition-opacity duration-300 sm:block ${active ? "opacity-100" : "opacity-70"}`}>{tr(template.description)}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4" role="radiogroup" aria-label={tr("Resume template")}>
      {templates.map((template) => {
        const active = selectedTemplate === template.id;
        return (
          <button
            key={template.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => handleSelect(template.id)}
            className={`group relative overflow-hidden rounded-lg border-2 bg-card text-left transition-all ${
              active
                ? "border-blue-600 shadow-lg ring-4 ring-blue-600/10"
                : "border-border hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            }`}
          >
            {isPopular(template.id) && <PopularRibbon />}
            {active && (
              <span className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
            )}
            <div className="bg-muted p-2">
              <Image
                src={template.imageUrl}
                alt={tr("{name} preview", { name: short(template.name) })}
                width={250}
                height={350}
                className="h-auto w-full rounded-sm shadow-sm"
              />
            </div>
            <div className="p-2.5">
              <p className="text-sm font-bold leading-tight">{short(template.name)}</p>
              <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{tr(template.description)}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
