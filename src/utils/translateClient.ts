import type { ProfileData } from "@/context/profileContext";
import { authFetch } from "@/lib/authFetch";
import { applyTexts, translatableTexts, type ResumeLanguage } from "@/lib/resumeTranslate";

// What was already translated is kept in this browser (per language), so the same text is never sent to the AI twice: translating a resume
// again, or another resume that shares its bullets and skills, only asks for what is new.
const CACHE_KEY = "kaizo_translations_v1";
const MAX_ENTRIES = 4000;
const MAX_CHARS = 600_000;
const BATCH = 200;

type Cache = Map<string, string>;
const keyOf = (target: ResumeLanguage, text: string) => `${target}|${text.trim()}`;

function readCache(): Cache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const pairs = raw ? (JSON.parse(raw) as unknown) : [];
    return new Map(Array.isArray(pairs) ? (pairs as [string, string][]).filter((p) => Array.isArray(p) && typeof p[0] === "string" && typeof p[1] === "string") : []);
  } catch {
    return new Map(); // storage unavailable or damaged: nothing is remembered
  }
}

function writeCache(cache: Cache) {
  try {
    // the newest entries stay (a Map keeps the order of insertion), within a size the browser's storage can hold
    let pairs = Array.from(cache.entries()).slice(-MAX_ENTRIES);
    let json = JSON.stringify(pairs);
    while (json.length > MAX_CHARS && pairs.length > 50) {
      pairs = pairs.slice(Math.ceil(pairs.length / 4));
      json = JSON.stringify(pairs);
    }
    localStorage.setItem(CACHE_KEY, json);
  } catch {
    /* storage full or unavailable: it translates again next time */
  }
}

async function askServer(texts: string[], target: ResumeLanguage): Promise<string[]> {
  const res = await authFetch("/api/translate-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, target }),
  });
  const body = (await res.json().catch(() => ({}))) as { texts?: string[]; error?: string };
  if (!res.ok || !Array.isArray(body.texts) || body.texts.length !== texts.length) throw new Error(body.error || "We couldn't translate your resume right now.");
  return body.texts;
}

/** The profile with its texts translated (company names, schools, tools and dates stay as they are). Only the texts not translated before are sent. */
export async function translateProfile(data: Partial<ProfileData>, target: ResumeLanguage): Promise<Partial<ProfileData>> {
  const texts = translatableTexts(data);
  const cache = readCache();
  // each different text once, in the order it appears
  const missing = Array.from(new Set(texts.filter((t) => t.trim() && !cache.has(keyOf(target, t))).map((t) => t.trim())));
  for (let i = 0; i < missing.length; i += BATCH) {
    const group = missing.slice(i, i + BATCH);
    const done = await askServer(group, target);
    group.forEach((t, n) => cache.set(keyOf(target, t), done[n] || t));
  }
  if (missing.length > 0) writeCache(cache);
  return applyTexts(
    data,
    texts.map((t) => (t.trim() ? cache.get(keyOf(target, t)) ?? t : t))
  );
}
