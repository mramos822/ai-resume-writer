import { ALL_SKILLS } from "@/lib/skills";

// other ways people write the same skill, so "JS" on a resume counts for a posting that asks for JavaScript
const ALIAS: Record<string, string> = {
  js: "javascript", ecmascript: "javascript", ts: "typescript", node: "node.js", nodejs: "node.js", "node js": "node.js",
  "react.js": "react", reactjs: "react", "react js": "react", "vue.js": "vue", vuejs: "vue", "angular.js": "angularjs",
  postgres: "postgresql", psql: "postgresql", mongo: "mongodb", k8s: "kubernetes", golang: "go", "c sharp": "c#", "c plus plus": "c++",
  "ms excel": "excel", "microsoft excel": "excel", "ms word": "word", "microsoft word": "word", "ms office": "microsoft office", gh: "github", py: "python",
};
const canon = (s: string) => {
  const k = s.trim().toLowerCase().replace(/\s+/g, " ");
  return ALIAS[k] ?? k;
};

const KNOWN = new Map(ALL_SKILLS.map((s) => [s.toLowerCase(), s]));
const partsCache = new Map<string, string[]>();

/**
 * The standard skills a skill is built on, longest first: "GitHub Actions" is built on "GitHub", "SQL Server" on "SQL".
 * A person who has the first one has the second, and a posting that asks for the second is satisfied by it.
 */
export function baseSkills(skill: string): string[] {
  const key = skill.trim().toLowerCase();
  const hit = partsCache.get(key);
  if (hit) return hit;
  const w = key.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let n = w.length - 1; n >= 1; n--) {
    for (let i = 0; i + n <= w.length; i++) {
      const found = KNOWN.get(w.slice(i, i + n).join(" "));
      if (found && !out.includes(found)) out.push(found);
    }
  }
  partsCache.set(key, out);
  return out;
}

/** True when `mine` is the skill `asked` or is built on it ("GitHub Actions" covers "GitHub"). */
export const covers = (mine: string, asked: string) => {
  const a = canon(asked);
  return canon(mine) === a || baseSkills(canon(mine)).some((b) => canon(b) === a) || baseSkills(mine).some((b) => canon(b) === a);
};

/**
 * The skills of a resume written the way the posting asks for them: "GitHub Actions" becomes "GitHub" when the posting asks
 * for GitHub and does not name GitHub Actions. Repeats that come out of this are dropped; the order is kept.
 */
export function simplifyForPosting(skills: string[], postingText: string): string[] {
  const asked = new Set(mentionedSkills(postingText).map((s) => s.toLowerCase()));
  const out: string[] = [];
  for (const s of skills) {
    const own = asked.has(s.trim().toLowerCase());
    const base = own ? undefined : baseSkills(s).find((b) => asked.has(b.toLowerCase()));
    const use = base ?? s;
    if (!out.some((x) => x.toLowerCase() === use.toLowerCase())) out.push(use);
  }
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Words of the list that a posting also uses as plain language ("matrixed organization", "the CSE initiative", "research accelerator"):
// they are not counted as skills from free text, because they say nothing about what the job asks of the person.
const PLAIN_LANGUAGE = new Set(["organization", "initiative", "research", "sales", "insurance", "banking", "compliance", "driving", "cleaning", "packing", "painting", "filing", "typing", "editing", "reliability", "flexibility", "coaching", "scheduling", "forecasting", "logistics", "diagnostics", "translation", "interpretation", "bilingual"]);
// Names that are also ordinary words or other abbreviations: they count only when written like the name (Go, Swift, Rust, Oracle, Epic...).
const CASE_SENSITIVE = new Set(["Go", "Swift", "Rust", "Ruby", "Dart", "Julia", "Unity", "Sketch", "Canvas", "Oracle", "Epic", "Buffer", "Notion", "Bash", "Spring", "Flask", "Lua", "Scala", "CAD", "SAP", "GIS", "PCR", "SEM", "SEO", "CRM", "SIEM", "ETL", "DNS", "VPN", "ITIL", "HRIS", "CPR", "ACLS", "GAAP", "SPSS", "Assembly", "Slack", "Zoom", "Cisco", "Looker", "Airflow", "Blender", "Jenkins", "Cypress", "Express.js"]);
/** "(CAD)" after a salary is the Canadian dollar, not computer-aided design; the same for the other currency codes that are also skills. */
const CURRENCY = /(\d[\d,.]*\s*(?:k|m)?\s*[-–]?\s*\$?[\d,.]*\s*\(?\s*CAD\b)|(\(CAD\))|(\bCAD\s*\$)|(\$\s*[\d,.]+\s*CAD\b)/;

/** Skills of the big list that the text mentions (whole words only). */
export function mentionedSkills(text: string): string[] {
  const out: string[] = [];
  const asked = text.replace(new RegExp(CURRENCY.source, "g"), " ");
  for (const s of ALL_SKILLS) {
    if (s.length < 2) continue;
    if (PLAIN_LANGUAGE.has(s.toLowerCase())) continue;
    const re = new RegExp(`(^|[^A-Za-z0-9+#])${esc(s)}($|[^A-Za-z0-9+#])`, CASE_SENSITIVE.has(s) ? "" : "i");
    if (re.test(asked)) out.push(s);
  }
  return out;
}

export interface SkillGap {
  /** skills the job mentions that the person already has */
  matched: string[];
  /** skills the job mentions that the person does not list */
  missing: string[];
  /** the ones among `matched` that the person did not list but the resume itself shows (in a job, a project...) */
  fromText?: string[];
}

/** What a posting asks for compared with the person's skills. */
export function skillGap(postingText: string, mySkills: string[], resumeText = ""): SkillGap {
  const mentioned = mentionedSkills(postingText);
  // skills the resume shows in its jobs, projects or studies even if they are not in the list of skills
  const shown = resumeText ? mentionedSkills(resumeText) : [];
  const listed = (s: string) => mySkills.some((m) => covers(m, s));
  const inText = (s: string) => shown.some((t) => covers(t, s));
  return {
    matched: mentioned.filter((s) => listed(s) || inText(s)),
    missing: mentioned.filter((s) => !listed(s) && !inText(s)),
    fromText: mentioned.filter((s) => !listed(s) && inText(s)),
  };
}
