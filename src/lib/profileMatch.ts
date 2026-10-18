// Recognizes when two profiles are of the same person (the same name, written a bit differently) and merges their details.
import { fold } from "@/lib/fold";

const GENERIC = /^(john doe|profile \d+|perfil \d+|your name|tu nombre)$/;

/** True for a name that says nothing (the sample person, "Profile 2"…). */
export const isGenericName = (name?: string): boolean => {
  const f = fold(name ?? "");
  return !f || GENERIC.test(f);
};

const tokens = (name: string) => fold(name).split(" ").filter((t) => t.length > 0);

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/**
 * Whether two names are probably the same person: the same words in any order ("Ramos Mariano"), one name inside the other
 * ("Mariano Ramos" and "Mariano José Ramos Pérez"), or a small typo ("Mariano Ramoz"). A name that says nothing never matches.
 */
export function sameName(a?: string, b?: string): boolean {
  if (isGenericName(a) || isGenericName(b)) return false;
  const fa = fold(a!);
  const fb = fold(b!);
  if (fa === fb) return true;
  const ta = tokens(a!);
  const tb = tokens(b!);
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  // every word of the shorter name is in the longer one (two words at least, so a first name alone does not match everyone)
  if (small.length >= 2 && small.every((w) => big.some((x) => x === w || (w.length > 3 && x.length > 3 && distance(w, x) <= 1)))) return true;
  // a small typo in the whole name
  return fa.length >= 8 && distance(fa, fb) <= Math.max(1, Math.round(fa.length * 0.12));
}

const filled = (v: unknown): boolean => {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
};

/**
 * What the profile holds after a newer resume of the same person is added: everything the new resume has wins, and what only the
 * old profile had (a photo, a section the new resume does not have) is kept instead of being lost.
 */
export function mergeProfileData(prev: Record<string, unknown> | undefined, next: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(prev ?? {}) };
  for (const [k, v] of Object.entries(next ?? {})) {
    if (k === "contactInfo" && typeof v === "object" && v) {
      const oldC = (prev?.contactInfo ?? {}) as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...oldC };
      for (const [ck, cv] of Object.entries(v as Record<string, unknown>)) if (filled(cv)) merged[ck] = cv;
      out.contactInfo = merged;
    } else if (filled(v)) out[k] = v;
  }
  return out;
}
