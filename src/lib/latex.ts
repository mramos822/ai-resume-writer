// src/lib/latex.ts
// Helpers for rendering user data into LaTeX templates.

/** Escape LaTeX special characters (also used as the EJS escape function). */
export function latexEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}
