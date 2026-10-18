import { asTemplateId, isTemplateId, type TemplateId } from "@/lib/templates";

/**
 * Colors the looks that have one can wear. The person picks one and the look draws its headings, rules, dots and side column with it.
 * Names are in English; the screens translate them.
 */
export interface Accent {
  id: string;
  name: string;
  hex: string;
}

export const ACCENTS: Accent[] = [
  { id: "navy", name: "Navy", hex: "#1f3a5f" },
  { id: "blue", name: "Blue", hex: "#2f5d9e" },
  { id: "teal", name: "Teal", hex: "#0f766e" },
  { id: "emerald", name: "Emerald", hex: "#15803d" },
  { id: "burgundy", name: "Burgundy", hex: "#7a2e3a" },
  { id: "plum", name: "Plum", hex: "#6d2f86" },
  { id: "terracotta", name: "Terracotta", hex: "#b45309" },
  { id: "charcoal", name: "Charcoal", hex: "#2f3a45" },
  { id: "crimson", name: "Crimson", hex: "#b42318" },
  { id: "cocoa", name: "Cocoa", hex: "#6b4337" },
  { id: "slate", name: "Slate", hex: "#5f717d" },
];

/** The looks that use a color, and the one each wears until the person picks another. */
export const DEFAULT_ACCENT: Partial<Record<TemplateId, string>> = {
  executive: "navy",
  tech: "teal",
  elegant: "burgundy",
  timeline: "blue",
  sidebar: "blue",
  legal: "navy",
  press: "crimson",
  health: "teal",
  corporate: "charcoal",
  banner: "burgundy",
  noir: "charcoal",
  blossom: "cocoa",
  pastel: "navy",
  atelier: "slate",
  warm: "terracotta",
  academic: "navy",
  halftone: "teal",
  shokumu: "charcoal",
};

export const supportsAccent = (template: unknown): boolean => isTemplateId(template) && template in DEFAULT_ACCENT;

/** The id of the color a look will use: the person's choice when it exists, else the look's own. */
export function accentIdFor(template: unknown, chosen?: string): string {
  const t = asTemplateId(template);
  return ACCENTS.some((a) => a.id === chosen) ? (chosen as string) : DEFAULT_ACCENT[t] ?? "blue";
}

export const accentHex = (template: unknown, chosen?: string): string => ACCENTS.find((a) => a.id === accentIdFor(template, chosen))?.hex ?? "#2f5d9e";

const toRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

/** The color mixed with white: 0 is the color, 1 is white. */
export function tint(hex: string, amount: number): string {
  return toHex(toRgb(hex).map((v) => v + (255 - v) * amount));
}
/** The color mixed with black: 0 is the color, 1 is black. */
export function shade(hex: string, amount: number): string {
  return toHex(toRgb(hex).map((v) => v * (1 - amount)));
}

/** CSS variables for the on-screen preview, so the sheet is drawn with the chosen color. */
export function accentVars(template: unknown, chosen?: string): Record<string, string> {
  const base = accentHex(template, chosen);
  const dark = shade(base, 0.5);
  return {
    "--acc": base,
    "--acc-soft": tint(base, 0.85),
    "--acc-dark": dark,
    "--acc-mid": tint(dark, 0.14),
    "--acc-light": tint(base, 0.6),
  };
}
