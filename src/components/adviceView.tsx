"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { Lightbulb } from "lucide-react";

/**
 * Renders AI advice (markdown) as friendly on-brand text: no raw "###" or "**",
 * headings become small labels, bullets become tip rows.
 */
export default function AdviceView({ text }: { text: string }) {
  return (
    <div className="animate-pop-in mt-5 rounded-lg border bg-accent/40 p-5 text-sm leading-relaxed">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h3 className="mb-2 mt-4 text-base font-bold first:mt-0">{children}</h3>,
          h2: ({ children }) => <h3 className="mb-2 mt-4 text-base font-bold first:mt-0">{children}</h3>,
          h3: ({ children }) => <h3 className="mb-2 mt-4 text-base font-bold first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-1 mt-3 font-semibold first:mt-0">{children}</h4>,
          p: ({ children }) => <p className="mb-3 text-muted-foreground last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          hr: () => <hr className="my-4 border-border" />,
          ul: ({ children }) => <ul className="mb-3 space-y-2 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-2 pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => (
            <li className="flex gap-2.5 text-muted-foreground [ol>&]:block">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 [ol>&]:hidden" />
              <span className="min-w-0">{children}</span>
            </li>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 underline">
              {children}
            </a>
          ),
          code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 text-xs">{children}</code>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
