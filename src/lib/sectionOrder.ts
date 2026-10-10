// The order of the sections of the resume, chosen by the person (drag and drop on the final screen).
// The default order of every look is kept until they move something.
export const SECTION_IDS = ["about", "skills", "job", "education", "extras"] as const;

/**
 * `available` are the sections this look can place in the order (in its own default order). The saved order puts some of
 * them first, in the person's order; anything it does not mention keeps its default place after those.
 */
export function orderedSections(saved: string[] | undefined, available: string[]): string[] {
  if (!saved || saved.length === 0) return available;
  const mine = saved.filter((id) => available.includes(id));
  const seen = new Set(mine);
  return [...mine, ...available.filter((id) => !seen.has(id))];
}
