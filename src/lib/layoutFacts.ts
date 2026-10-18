// What the AI needs to know about the LOOK and the LENGTH of the resume, so its advice fits the format the person chose and the role they
// aim for (an ATS-safe look is not told to worry about parsing; a designed look is told to keep the key words in plain text; the length
// they chose is respected). Code decides these facts; the AI only reasons from them.
import type { ProfileData } from "@/context/profileContext";
import { TWO_COLUMN } from "@/lib/templates";
import { asPageGoal, canRunTwoPages } from "@/lib/pageGoal";
import type { PageFit } from "@/lib/reviewRubric";

/** The looks an applicant tracking system reads without trouble: one column, plain text. */
export const ATS_SAFE_LOOKS: readonly string[] = ["ats", "classic", "essential"];

export type LookFamily = "ats-safe" | "one-column" | "two-column" | "form";

export function lookFamily(template: string): LookFamily {
  if (template === "rirekisho" || template === "shokumu") return "form";
  if ((TWO_COLUMN as readonly string[]).includes(template)) return "two-column";
  return ATS_SAFE_LOOKS.includes(template) ? "ats-safe" : "one-column";
}

export interface LayoutFacts {
  look: string;
  family: LookFamily;
  hasPhoto: boolean;
  hasSkillRatings: boolean;
  /** what the person chose: "one" page, "two" pages, or "kaizo" (let Kaizo decide) */
  lengthChoice: "one" | "two" | "kaizo";
  /** pages this look may use for that choice */
  pagesAllowed: number;
  /** can this look run onto a second sheet at all */
  canUseTwoPages: boolean;
  pagesNow: number;
  /** 1 = the text is at its normal size; below 0.85 it is small print */
  textScale: number;
  /** how full the last page is (0 to 1), when the resume has two */
  lastPageFill: number | null;
}

export function layoutFacts(p: ProfileData, template: string, fit: PageFit | null | undefined): LayoutFacts {
  const goal = asPageGoal(p.pageGoal);
  return {
    look: template,
    family: lookFamily(template),
    hasPhoto: Boolean(p.photo),
    hasSkillRatings: Object.keys(p.skillLevels ?? {}).length > 0,
    lengthChoice: goal === "any" ? "kaizo" : goal,
    pagesAllowed: fit?.maxPages ?? 1,
    canUseTwoPages: canRunTwoPages(template),
    pagesNow: fit?.pages ?? 1,
    textScale: Math.round((fit?.scale ?? 1) * 100) / 100,
    lastPageFill: fit?.lastFill ?? null,
  };
}

/** The same facts as plain sentences, for the prompts that do not get JSON. */
export function layoutSentence(f: LayoutFacts): string {
  const look = f.family === "ats-safe" ? "an ATS-safe look (one column, plain text)" : f.family === "one-column" ? "a designed one-column look" : f.family === "two-column" ? "a two-column look" : "a form-style look";
  const length = f.lengthChoice === "one" ? "one page" : f.lengthChoice === "two" ? "up to two pages" : "one page if it fits comfortably, else two";
  return `The person chose ${look} ("${f.look}") and ${length}. It has ${f.pagesNow} page${f.pagesNow > 1 ? "s" : ""} now with the text at ${Math.round(f.textScale * 100)}% of its normal size.`;
}
