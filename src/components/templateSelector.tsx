"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

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
    fetch('/api/templates')
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data);
        if (data.length > 0) {
          const defaultTemplate = data[0].id;
          setSelectedTemplate(defaultTemplate);
          onTemplateSelect(defaultTemplate);
        }
      });
  }, [onTemplateSelect]);

  const handleSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    onTemplateSelect(templateId);
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {templates.map((template) => (
        <div
          key={template.id}
          className={`cursor-pointer border-2 rounded-lg p-4 ${
            selectedTemplate === template.id
              ? 'border-blue-500'
              : 'border-transparent'
          } flex flex-col items-center text-center`}
          onClick={() => handleSelect(template.id)}
        >
          <Image
            src={template.imageUrl}
            alt={template.name}
            width={250}
            height={350}
            className="rounded-md object-contain"
          />
          <h3 className="text-lg font-semibold mt-2">{template.name}</h3>
          <p className="text-sm text-gray-500">{template.description}</p>
        </div>
      ))}
    </div>
  );
}
