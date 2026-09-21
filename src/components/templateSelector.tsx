"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Check } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

interface TemplateSelectorProps {
  onTemplateSelect: (templateId: string) => void;
}

export default function TemplateSelector({ onTemplateSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((res) => res.json())
      .then((data: Template[]) => {
        setTemplates(data);
        if (data.length > 0) {
          const defaultTemplate = data[0].id;
          setSelectedTemplate(defaultTemplate);
          onTemplateSelect(defaultTemplate);
        }
      })
      .catch(console.error);
  }, [onTemplateSelect]);

  const handleSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    onTemplateSelect(templateId);
  };

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
              <p className="text-sm font-bold leading-tight">{template.name.replace(" (Default)", "")}</p>
              <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{template.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
