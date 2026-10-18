/** Optional groups of skills, like "Languages: Java, Python" in a classic resume. Stored as skill -> group name. */
export type SkillGroups = Record<string, string>;

export interface SkillGroup {
  /** "" for the skills that are in no group */
  label: string;
  skills: string[];
}

/** The groups in the order their first skill appears. Skills with no group come together (label ""), where the first one was. */
export function groupSkills(skills: string[], groups: SkillGroups | undefined): SkillGroup[] {
  const out: SkillGroup[] = [];
  for (const skill of skills) {
    const label = (groups?.[skill] ?? "").trim();
    let g = out.find((x) => x.label === label);
    if (!g) {
      g = { label, skills: [] };
      out.push(g);
    }
    g.skills.push(skill);
  }
  return out;
}

/** True when at least one of the skills is in a named group. */
export function hasSkillGroups(skills: string[], groups: SkillGroups | undefined): boolean {
  return skills.some((s) => (groups?.[s] ?? "").trim() !== "");
}

/** Only the groups of skills that still exist, with clean names. */
export function cleanSkillGroups(skills: string[], groups: SkillGroups | undefined): SkillGroups {
  const out: SkillGroups = {};
  for (const s of skills) {
    const label = (groups?.[s] ?? "").trim().slice(0, 40);
    if (label) out[s] = label;
  }
  return out;
}

/** Names offered with one tap when making a group. */
export const GROUP_SUGGESTIONS = ["Languages", "Frameworks", "Databases", "Tools", "Cloud", "Soft skills"];
