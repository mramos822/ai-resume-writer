const MARKER = /^\s*(?:[•\-*–—·]\s*)+/;

/** Every line starts with "• " (empty lines stay as empty bullets while typing). */
export function normalizeBullets(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => `• ${line.replace(MARKER, "")}`)
    .join("\n");
}

/** The bullet texts, without markers and without empty lines. */
export function toBullets(text: string): string[] {
  return (text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(MARKER, "").trim())
    .filter(Boolean);
}

/** Strong verbs a resume bullet can start with. */
export const ACTION_VERBS = [
  "Led", "Managed", "Built", "Created", "Improved", "Organized", "Trained", "Served", "Developed", "Designed",
  "Increased", "Reduced", "Handled", "Coordinated", "Launched", "Maintained", "Analyzed", "Supported",
];

const WEAK_STARTS = /^(responsible for|helped with|worked on|duties included|tasked with|in charge of|i\s)/i;

export interface BulletTip {
  tone: "good" | "tip";
  text: string;
}

/** Friendly, specific feedback on what the person wrote so far. */
export function bulletTips(bullets: string[]): BulletTip[] {
  const tips: BulletTip[] = [];
  if (bullets.length === 0) {
    return [{ tone: "tip", text: "Write what you did as short bullets. Press Enter for each new one." }];
  }
  if (bullets.length < 3) {
    const n = 3 - bullets.length;
    tips.push({ tone: "tip", text: `Add ${n} more bullet${n > 1 ? "s" : ""}. Three to five is ideal.` });
  }
  if (bullets.length > 6) {
    tips.push({ tone: "tip", text: "That is a lot of bullets. Keep the 5 strongest and put them first." });
  }
  const weak = bullets.find((b) => WEAK_STARTS.test(b));
  if (weak) {
    tips.push({ tone: "tip", text: `Start with a strong verb instead of “${weak.split(" ").slice(0, 2).join(" ")}…”, like Led, Built or Served.` });
  }
  if (!bullets.some((b) => /\d/.test(b))) {
    tips.push({ tone: "tip", text: "Add a number somewhere: how many people, how often, how much. “Served 100+ customers a day” beats “helped customers”." });
  }
  const long = bullets.find((b) => b.length > 170);
  if (long) {
    tips.push({ tone: "tip", text: "One bullet is very long. Aim for under two lines (about 150 characters)." });
  }
  if (tips.length === 0) tips.push({ tone: "good", text: "Looks strong. Clear, specific bullets are what recruiters scan for." });
  return tips;
}
