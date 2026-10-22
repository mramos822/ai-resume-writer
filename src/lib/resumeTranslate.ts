// Which language a resume is written in, and which of its texts are translated when the person asks for it.
import type { ProfileData } from "@/context/profileContext";

export type ResumeLanguage = "en" | "es";

/** The names of the groups the skills are sorted in ("IT-Kenntnisse"), each once, in the order they appear. */
const groupNames = (p: Partial<ProfileData>): string[] => [...new Set(Object.values(p.skillGroups ?? {}).map((g) => String(g)).filter(Boolean))];

/** The free text of the profile, in a fixed order (the same order is used to put the translation back). */
export function translatableTexts(p: Partial<ProfileData>): string[] {
  const out: string[] = [];
  const add = (s?: string) => out.push((s ?? "").trim());
  add(p.jobTitle);
  add(p.careerObjective);
  for (const list of [p.jobHistory ?? [], p.internships ?? []]) {
    for (const j of list) {
      add(j.title);
      add(j.description);
      for (const a of j.accomplishments ?? []) add(a);
    }
  }
  for (const e of p.education ?? []) {
    // the title of the degree and the school are NOT translated: they are written as the school gives them (an empty text keeps its place in the
    // list, and an empty text is never sent nor changed)
    add("");
    add("");
    add(e.honors);
    add(e.coursework);
  }
  for (const pr of p.projects ?? []) {
    add(pr.description);
    for (const a of pr.accomplishments ?? []) add(a);
  }
  for (const s of p.skills ?? []) add(s);
  for (const g of groupNames(p)) add(g);
  for (const l of p.languages ?? []) add(l.name);
  for (const i of p.interests ?? []) add(i);
  for (const c of p.certifications ?? []) add(c.name);
  return out;
}

/** Puts translated texts (same order as `translatableTexts`) back; skills keep their level and group under the new name. */
export function applyTexts(p: Partial<ProfileData>, t: string[]): Partial<ProfileData> {
  let i = 0;
  // an empty original stays as it was; a missing translation keeps the original
  const take = (old?: string) => {
    const v = t[i++];
    return old && old.trim() ? v || old : old ?? "";
  };
  const jobTitle = take(p.jobTitle);
  const careerObjective = take(p.careerObjective);
  const jobs = (list: ProfileData["jobHistory"]) =>
    list.map((j) => ({ ...j, title: take(j.title), description: take(j.description), accomplishments: (j.accomplishments ?? []).map((a) => take(a)) }));
  const jobHistory = jobs(p.jobHistory ?? []);
  const internships = jobs(p.internships ?? []);
  const education = (p.education ?? []).map((e) => ({
    ...e,
    // the degree and the school keep their place in the list but are never replaced (see translatableTexts)
    degree: (i++, e.degree),
    school: (i++, e.school),
    honors: e.honors === undefined ? undefined : take(e.honors),
    coursework: e.coursework === undefined ? undefined : take(e.coursework),
  }));
  const projects = (p.projects ?? []).map((pr) => ({ ...pr, description: take(pr.description), accomplishments: (pr.accomplishments ?? []).map((a) => take(a)) }));
  const rename = new Map<string, string>();
  const skills = (p.skills ?? []).map((s) => {
    const n = take(s);
    if (n !== s) rename.set(s, n);
    return n;
  });
  const groupRename = new Map<string, string>();
  for (const g of groupNames(p)) {
    const n = take(g);
    if (n !== g) groupRename.set(g, n);
  }
  const languages = (p.languages ?? []).map((l) => ({ ...l, name: take(l.name) }));
  const interests = (p.interests ?? []).map((x) => take(x));
  const certifications = (p.certifications ?? []).map((c) => ({ ...c, name: take(c.name) }));
  const remap = <T,>(rec?: Record<string, T>) => (rec ? Object.fromEntries(Object.entries(rec).map(([k, v]) => [rename.get(k) ?? k, v])) : rec);
  const regroup = p.skillGroups
    ? Object.fromEntries(Object.entries(p.skillGroups).map(([k, v]) => [rename.get(k) ?? k, groupRename.get(String(v)) ?? v]))
    : p.skillGroups;
  return {
    ...p,
    jobTitle,
    careerObjective,
    jobHistory,
    internships,
    education,
    projects,
    skills,
    languages: p.languages ? languages : p.languages,
    interests: p.interests ? interests : p.interests,
    certifications: p.certifications ? certifications : p.certifications,
    skillLevels: remap(p.skillLevels) as ProfileData["skillLevels"],
    skillGroups: regroup as ProfileData["skillGroups"],
  };
}

const EN = new Set(
  "the and of to in for with on at by from as is are was were be been that this which who led built developed managed created improved using use across including through over into while their his her our your it its an a or not".split(" ")
);
const ES = new Set(
  "el la los las de del y en para con por que se un una unos unas al como es son fue fueron su sus lo más mas sobre entre desde hasta mediante incluyendo también donde cuando e o no mi tu nuestro nuestra liderando desarrollé desarrollo gestión experiencia equipo proyecto".split(" ")
);

/** "en" or "es" by the words of what the person wrote; null when there is too little text to tell. */
export function detectResumeLanguage(p: Partial<ProfileData>): ResumeLanguage | null {
  const text = translatableTexts(p)
    .filter((s) => s.length > 25)
    .join(" ")
    .toLowerCase();
  const words = text.match(/[a-záéíóúñü]+/g) ?? [];
  if (words.length < 25) return null;
  let en = 0;
  let es = 0;
  for (const w of words) {
    if (EN.has(w)) en++;
    if (ES.has(w)) es++;
    if (/[áéíóúñ]/.test(w)) es += 0.5;
  }
  if (Math.max(en, es) < 4) return null;
  if (es > en * 1.4) return "es";
  if (en > es * 1.4) return "en";
  return null;
}

const OTHER: Record<string, { name: string; words: Set<string> }> = {
  de: { name: "German", words: new Set("und der die das den dem des ein eine einer einem eines mit für von im zu auf bei als wurde wurden durch über unter nach aus ist sind sowie auch nicht ich mein meine sich zur zum am vom beim sowie bis seit oder wie wir unser unsere ihr ihre".split(" ")) },
  fr: { name: "French", words: new Set("et le la les des du de un une pour avec dans sur par au aux en est sont été chez sous mon ma mes nous vous ce cette ces qui que où comme ainsi aussi dont entre depuis pendant".split(" ")) },
  pt: { name: "Portuguese", words: new Set("e o a os as de do da dos das um uma para com em no na nos nas por que foi são ao à também pelo pela como mais entre desde sobre onde quando seu sua meu minha".split(" ")) },
  it: { name: "Italian", words: new Set("e il lo la i gli le di del della dei delle un una per con in su da che è sono stato presso nel nella nei ed anche come più tra fra dal dalla suo sua mio mia".split(" ")) },
  nl: { name: "Dutch", words: new Set("en de het een van voor met op bij als werd waren is zijn ook niet door over naar uit tot sinds mijn onze deze die dat".split(" ")) },
};

/**
 * A language other than English and Spanish, by the words of what the person wrote: its name in English ("German"), or "another
 * language" for scripts we do not tell apart (Cyrillic, Arabic, Chinese...). null when it is English, Spanish, or there is too little text.
 */
export function detectOtherLanguage(p: Partial<ProfileData>): string | null {
  const text = translatableTexts(p)
    .filter((s) => s.length > 15)
    .join(" ")
    .toLowerCase();
  if (text.length < 60) return null;
  // writing systems that are not Latin
  const letters = text.match(/\p{L}/gu) ?? [];
  const nonLatin = letters.filter((c) => { const n = c.charCodeAt(0); return n > 0x24f && !(n >= 0x1e00 && n <= 0x1eff); }).length;
  if (letters.length > 0 && nonLatin / letters.length > 0.4) return "another language";
  const words = text.match(/[\p{L}]+/gu) ?? [];
  if (words.length < 15) return null;
  const score = (set: Set<string>) => words.filter((w) => set.has(w)).length;
  const en = score(EN);
  const es = score(ES);
  let best = "";
  let top = 0;
  let second = 0;
  for (const [code, o] of Object.entries(OTHER)) {
    const n = score(o.words) + (code === "de" ? words.filter((w) => /[äöüß]/.test(w)).length * 0.5 : 0);
    if (n > top) {
      second = top;
      top = n;
      best = code;
    } else if (n > second) second = n;
  }
  // it has to beat English and Spanish clearly, and the other candidates too (the small words are shared between close languages)
  if (top < 4 || top < Math.max(en, es) * 1.3 || top < second * 1.25) return null;
  return OTHER[best].name;
}

