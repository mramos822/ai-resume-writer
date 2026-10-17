// How long the person wants the resume, and which looks can run to a second page. Light on purpose: the screens import it too.

export type PageGoal = "one" | "two" | "any";

/**
 * The looks that can run onto a second sheet: one column, drawn only with the pen's text, rules and bands (so a cut can be placed between
 * two blocks, see renderPaged in pdfResume). Each was checked by eye over two sheets. The others (two columns, side panels, the gallery
 * looks, Banner and Rirekisho) are designed as a single page and stay one page whatever the person prefers. Shokumu (a work-history form)
 * can run to two: its tables are cut between jobs, never through one.
 */
export const TWO_PAGE_TEMPLATES: readonly string[] = ["classic", "ats", "essential", "executive", "tech", "minimal", "elegant", "timeline", "legal", "press", "health", "corporate", "warm", "academic", "halftone", "shokumu"];

/** Always ONE sheet, whatever the person chose: the text is shrunk to fit, never moved to a second page. */
export const ONE_SHEET_ONLY: readonly string[] = ["modern", "creative", "sidebar", "banner"];

export const asPageGoal = (v: unknown): PageGoal => (v === "two" || v === "any" ? v : "one");

/** Can this look run to two pages? */
export const canRunTwoPages = (template: string): boolean => !ONE_SHEET_ONLY.includes(template) && TWO_PAGE_TEMPLATES.includes(template);

/** How many pages the person accepts for this look: 1, or 2 when they asked for it and the look can do it. */
export function maxPagesFor(profile: { pageGoal?: string }, template: string): number {
  return (profile.pageGoal === "two" || profile.pageGoal === "any") && canRunTwoPages(template) ? 2 : 1;
}
