import type { JobListing } from "@/lib/jobSearch";

/** How well a listing fits the profile: the share of the person's skills (and target role words) found in it. */
export function fitOf(job: JobListing, skills: string[], role: string): { pct: number; matched: string[] } {
  const hay = `${job.title} ${job.tags.join(" ")} ${job.snippet}`.toLowerCase();
  const matched = skills.filter((s) => s.trim() && hay.includes(s.toLowerCase().replace(/[()]/g, "").trim()));
  const roleWords = role.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 2);
  const roleHit = roleWords.length ? roleWords.filter((w) => job.title.toLowerCase().includes(w)).length / roleWords.length : 0;
  const skillPart = skills.length ? Math.min(1, matched.length / Math.max(3, Math.min(skills.length, 8))) : 0;
  const pct = Math.round(100 * (skills.length ? 0.6 * skillPart + 0.4 * roleHit : roleHit));
  return { pct: Math.max(0, Math.min(100, pct)), matched: matched.slice(0, 5) };
}

export const ago = (iso: string) => {
  const t = +new Date(iso);
  if (!t) return "";
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const m = Math.floor(days / 30);
  return `${m} month${m > 1 ? "s" : ""} ago`;
};
