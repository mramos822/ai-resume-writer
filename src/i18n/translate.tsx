import React from "react";
import type { Locale } from "@/i18n/config";
import { ES } from "@/i18n/es";
import { ES_PATTERNS } from "@/i18n/patterns";

// The English text is the key. A Spanish entry in i18n/es replaces it; when there is none the English shows, so a missing
// translation never breaks a page. {name} marks a value to put in.
const missing = new Set<string>();
// in development the dictionary is visible from the browser console, to audit a page for English that is left
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as { __ES?: Record<string, string> }).__ES = ES;

export type Vars = Record<string, string | number | null | undefined>;
export type NodeVars = Record<string, React.ReactNode>;

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? "") : m)) : s);

export function makeT(locale: Locale) {
  const pick = (key: string) => {
    if (locale !== "es" || key === "") return key;
    const hit = ES[key];
    if (hit === undefined) {
      if (typeof window !== "undefined" && process.env.NODE_ENV !== "production" && !missing.has(key)) {
        missing.add(key);
        (window as unknown as { __missingI18n?: string[] }).__missingI18n = Array.from(missing);
      }
      return key;
    }
    return hit;
  };

  /** Text, with {name} values. */
  // a missing value (undefined) gives an empty text, so text coming from data can pass through without a check
  function t(key: string | number | null | undefined, vars?: Vars): string;
  function t<T extends React.ReactElement | object>(key: T, vars?: Vars): T;
  function t(key: unknown, vars?: Vars): unknown {
    if (key == null) return "";
    if (typeof key !== "string" && typeof key !== "number") return key; // already something to draw (an element): leave it
    return fill(pick(String(key)), vars);
  }

  /** Text with pieces of the page in it (a link inside a sentence): "Read the {terms} and the {privacy}". */
  const tx = (key: string, nodes: NodeVars): React.ReactNode => {
    const parts = pick(key).split(/(\{\w+\})/g);
    return parts.map((p, i) => {
      const m = /^\{(\w+)\}$/.exec(p);
      return m && m[1] in nodes ? <React.Fragment key={i}>{nodes[m[1]]}</React.Fragment> : p;
    });
  };

  /** Text made by code or by the AI, in sentences: each sentence is translated if we know it (the dictionary, then the patterns). */
  const td = (text: string | null | undefined): string => {
    if (!text) return "";
    if (locale !== "es") return text;
    const one = (p: string) => {
      const hit = ES[p];
      if (hit !== undefined) return hit;
      for (const [re, fn] of ES_PATTERNS) {
        const m = re.exec(p);
        if (m) return fn(m);
      }
      return p;
    };
    if (ES[text] !== undefined) return ES[text];
    return text.split(/(?<=[.!?])\s+/).map(one).join(" ");
  };

  // `tr` / `trx` are the names used in components: `t` is too often a variable name there
  return { t, tx, td, tr: t, trx: tx, trd: td, locale };
}

/** The shape of tr(): lib functions that make text take one, and use English when none is given. */
export type Tr = (key: string, vars?: Vars) => string;
export const EN: Tr = (key, vars) => fill(key, vars);
