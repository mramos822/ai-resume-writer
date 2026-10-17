// Resumes in some looks print the name in capitals ("TAYLOR COOK"). Reading one must not make the profile shout: a name or a title that is
// ALL CAPITALS is written as words ("Taylor Cook"). Anything with a lower-case letter is left exactly as the person wrote it.

const SMALL = new Set(["de", "del", "la", "las", "los", "da", "das", "do", "dos", "van", "von", "der", "den", "di", "du", "el", "al", "bin", "ibn", "and", "of", "the"]);

/** True when the text has letters and none of them is lower case. */
// A lone short word in capitals ("CEO", "HR", "SQL") is an acronym, not shouting: it takes two words or five letters.
export const isShouting = (s: string): boolean => {
  if (!/[A-ZÀ-ÖØ-Þ]/.test(s) || /[a-zß-öø-ÿ]/.test(s)) return false;
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "").length;
  const words = s.trim().split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]/.test(w)).length;
  return letters >= 3 && (words >= 2 || letters >= 5);
};

function word(w: string, first: boolean): string {
  const lower = w.toLowerCase();
  if (!first && SMALL.has(lower)) return lower;
  // "O'BRIEN" -> "O'Brien", "SMITH-JONES" -> "Smith-Jones", "MCDONALD" stays "Mcdonald" (a guess is worse than a plain capital)
  return lower.replace(/(^|[-'’.])([a-zà-öø-ÿ])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** "TAYLOR COOK" -> "Taylor Cook". Text that is not all capitals comes back unchanged. */
export function fromShouting(s: string): string {
  const text = (s ?? "").trim();
  if (!isShouting(text)) return s;
  return text
    .split(/\s+/)
    .map((w, i) => word(w, i === 0))
    .join(" ");
}
