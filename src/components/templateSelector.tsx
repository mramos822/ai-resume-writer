"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { loadTemplates } from "@/lib/templatePreload";

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

  const short = (name: string) => name.replace(" (Default)", "");

  if (showcase) {
    const selIndex = Math.max(0, templates.findIndex((t) => t.id === selectedTemplate));
    // The sheets are fully loaded before this renders (see lib/templatePreload), so they just animate in: no placeholder
    if (templates.length === 0) return <div className="min-h-[24rem]" aria-busy />;
    return (
      <div className="relative">
        <div className="grid grid-cols-3 items-start gap-5 sm:gap-10" role="radiogroup" aria-label="Resume template">
          {templates.map((template, i) => {
            const active = selectedTemplate === template.id;
            // the chosen sheet sits straight and a little larger; the others fan out like papers on a desk
            const tilt = active ? 0 : (i - selIndex) * 1.6;
            return (
              <motion.div
                key={template.id}
                className="flex flex-col items-center"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handleSelect(template.id)}
                  style={{ transform: `rotate(${tilt}deg) scale(${active ? 1.04 : 0.97})`, maxWidth: "min(27rem, calc((100dvh - 20rem) * 0.714))" }}
                  className={`relative w-full origin-bottom overflow-hidden bg-white p-1.5 transition-all duration-500 ease-out ${
                    active
                      ? "z-10 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.45)] outline outline-2 outline-offset-4 outline-blue-600"
                      : "shadow-[0_10px_24px_-10px_rgba(0,0,0,0.4)] hover:-translate-y-1"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={template.imageUrl} alt={`${short(template.name)} preview`} width={600} height={840} decoding="sync" className="h-auto w-full" />
                  <AnimatePresence>
                    {active && (
                      <motion.span
                        key={template.id}
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        className="absolute inset-x-1.5 bottom-1.5 block bg-neutral-900/90 px-4 py-3 text-center text-xs font-medium leading-snug text-white backdrop-blur-sm"
                      >
                        {template.description}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => handleSelect(template.id)}
                  className={`mt-5 border-b-2 pb-0.5 text-sm font-semibold tracking-wide transition-colors ${
                    active ? "border-blue-600 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {short(template.name)}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4" role="radiogroup" aria-label="Resume template">
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
            {active && (
              <span className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
            )}
            <div className="bg-muted p-2">
              <Image
                src={template.imageUrl}
                alt={`${template.name} preview`}
                width={250}
                height={350}
                className="h-auto w-full rounded-sm shadow-sm"
              />
            </div>
            <div className="p-2.5">
              <p className="text-sm font-bold leading-tight">{short(template.name)}</p>
              <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{template.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
