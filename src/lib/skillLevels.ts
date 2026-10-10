/** Optional confidence per skill: 1 to 5. A skill with no level shows no bar, dots or label. */
export const SKILL_LEVEL_LABELS = ["Beginner", "Basic", "Intermediate", "Advanced", "Expert"] as const;

export type SkillLevels = Record<string, number>;

/** The level (1 to 5) of a skill, or 0 when the person didn't set one. */
export function skillLevel(levels: SkillLevels | undefined, skill: string): number {
  const n = Math.round(Number(levels?.[skill] ?? 0));
  return n >= 1 && n <= 5 ? n : 0;
}

export function skillLevelLabel(level: number): string {
  return SKILL_LEVEL_LABELS[level - 1] ?? "";
}

/** "★★★☆☆" for Classic. */
export function levelStarsText(level: number): string {
  return "★".repeat(level) + "☆".repeat(5 - level);
}

/** "●●●○○" for the on-screen preview. */
export function levelDotsText(level: number): string {
  return "●".repeat(level) + "○".repeat(5 - level);
}
