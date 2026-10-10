import { ALL_SKILLS } from "@/lib/skills";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Skills of the big list that the text mentions (whole words only). */
export function mentionedSkills(text: string): string[] {
  const out: string[] = [];
  for (const s of ALL_SKILLS) {
    if (s.length < 2) continue;
    const re = new RegExp(`(^|[^A-Za-z0-9+#])${esc(s)}($|[^A-Za-z0-9+#])`, "i");
    if (re.test(text)) out.push(s);
  }
  return out;
}

export interface SkillGap {
  /** skills the job mentions that the person already has */
  matched: string[];
  /** skills the job mentions that the person does not list */
  missing: string[];
}

/** What a posting asks for compared with the person's skills. */
export function skillGap(postingText: string, mySkills: string[]): SkillGap {
  const have = new Set(mySkills.map((s) => s.toLowerCase()));
  const mentioned = mentionedSkills(postingText);
  return { matched: mentioned.filter((s) => have.has(s.toLowerCase())), missing: mentioned.filter((s) => !have.has(s.toLowerCase())) };
}
