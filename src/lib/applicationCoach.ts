// Before a resume is made for a job: Kaizo asks what the person has that the resume does not show, and judges the draft.
// Server side. The AI only works with the resume and the posting, and with what the person confirmed; it invents nothing.
import { namesEmployer, withoutEmployer } from "@/lib/employerMention";
import { getOpenAIChatCompletionWithFallback } from "@/lib/openaiClient";
import { AI_MODEL, AI_MODEL_STRONG } from "@/lib/aiConfig";
import { cleanFix, profileForReview, type ReviewFix } from "@/lib/resumeReview";
import { resumeText } from "@/lib/roleProfile";
import { narrativeText, saysTerm } from "@/lib/jobScore";
import { jobLang, type ResumeLang } from "@/lib/resumeLang";
import { askedSkills, baseSkills, covers, mentionedSkills } from "@/lib/jobSkills";
import { faithfulBullets } from "@/lib/bulletFidelity";
import { promptVersion } from "@/lib/promptVersion";
import { MIN_RECENT_JOBS, newestFirst, type PageFit } from "@/lib/reviewRubric";
import { passesPage } from "@/lib/pageRules";
import { layoutFacts } from "@/lib/layoutFacts";
import { fieldFromText, type LookField } from "@/lib/jobField";
import { suggestedGroup } from "@/lib/skillCategories";
import type { JobListing } from "@/lib/jobSearch";
import type { ProfileData } from "@/context/profileContext";

export const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** An answer of the person to a question: only the "yes" ones count as facts. */
export interface Answer {
  question: string;
  yes: boolean;
  note: string;
}

export const cleanAnswers = (v: unknown): Answer[] =>
  (Array.isArray(v) ? v : [])
    .map((a) => ({ question: clip((a as Answer)?.question, 240), yes: (a as Answer)?.yes === true, note: clip((a as Answer)?.note, 300) }))
    .filter((a) => a.question)
    .slice(0, 8);

/** The parts of a profile a draft for one job may change. Anything else in the draft is ignored. */
const DRAFT_TEXT = ["name", "jobTitle", "careerObjective", "photo", "accentColor"] as const;
const DRAFT_LISTS = ["skills", "jobHistory", "education", "internships", "projects", "languages", "links", "certifications", "interests"] as const;
const DRAFT_OBJECTS = ["contactInfo", "skillLevels", "skillGroups"] as const;

/**
 * The saved profile with the edits the person made for one job (the draft). Only known fields of the right type are taken, and a
 * draft that is too big is ignored. The saved profile itself is never changed.
 */
export function withDraft(saved: ProfileData, draft: unknown): ProfileData {
  if (!draft || typeof draft !== "object" || JSON.stringify(draft).length > 300_000) return saved;
  const d = draft as Record<string, unknown>;
  const out: Record<string, unknown> = { ...(saved as unknown as Record<string, unknown>) };
  for (const k of DRAFT_TEXT) if (typeof d[k] === "string") out[k] = (d[k] as string).slice(0, 5000);
  for (const k of DRAFT_LISTS) if (Array.isArray(d[k])) out[k] = (d[k] as unknown[]).slice(0, 100);
  if (typeof d.fillPage === "boolean") out.fillPage = d.fillPage;
  if (d.pageGoal === "one" || d.pageGoal === "two" || d.pageGoal === "any") out.pageGoal = d.pageGoal;
  for (const k of DRAFT_OBJECTS) if (d[k] && typeof d[k] === "object" && !Array.isArray(d[k])) out[k] = d[k];
  return out as unknown as ProfileData;
}

/** A skill worth a second look when the list is long, and why: it repeats another, it is generic, or the job does not ask for it. */
export interface ReviewSkill {
  skill: string;
  why: "repeats" | "generic" | "notAsked";
  /** for "repeats": the skill it repeats */
  of?: string;
}

/** From this many skills a crowded resume gets a list of the least necessary ones to look at. */
export const LONG_SKILL_LIST = 20;
/** A resume is never cut below this many skills (or all of them, when the person has fewer). */
export const MIN_SKILLS = 20;

export interface CutSuggestions {
  /** the least necessary skills, for the person to review one by one; only when the list is long (see LONG_SKILL_LIST) */
  review: ReviewSkill[];
  /** skills that the job does not need, or that repeat another one: they can leave this resume */
  skills: string[];
  /** older jobs that can leave this resume (never the most recent ones) */
  jobs: { id: string; title: string; company: string; start: string; end: string }[];
}

// The lists of skills (see lib/skillCategories) that belong to the career of each field. A skill of one of these lists is part of the
// general knowledge of that career, so it is never proposed for removal. The lists that every career uses are always kept.
const OWN_LISTS: Record<Exclude<LookField, "general">, string[]> = {
  tech: ["Programming languages", "Frameworks and libraries", "Databases", "Cloud and backend", "Tools", "Software development", "Data & AI", "IT & cybersecurity", "Engineering & science", "Design & creative"],
  creative: ["Design & creative", "Marketing & communications", "Tools", "Software development", "Sales & customer service"],
  business: ["Business, finance & accounting", "Human resources & recruiting", "Sales & customer service", "Marketing & communications", "Legal & public service", "Data & AI", "Tools", "Skilled trades & operations"],
  health: ["Healthcare", "Education & training", "Engineering & science", "Skilled trades & operations"],
  academic: ["Education & training", "Engineering & science", "Data & AI", "Legal & public service", "Software development", "Tools"],
};
const EVERY_CAREER = ["Soft skills", "Office & productivity", "Languages"];

/**
 * What can be taken out of the resume FOR THIS JOB when it does not fit on a page. It is only a proposal: the person decides, and the
 * saved profile is never touched. The most recent jobs stay, and so do at least 8 skills.
 *
 * Skills are only proposed when they are really not needed: an exact repeat, or a skill that belongs to a career far from the field of
 * the job and of the person (a nursing skill on a software resume). Anything that could be general knowledge of the career, soft skills,
 * office tools, languages and skills that are not in the lists are never proposed.
 */
export function cutSuggestions(p: ProfileData, job: JobListing, keep: string[] = []): CutSuggestions {
  const named = askedSkills(`${job.title}. ${job.tags.join(", ")}. ${job.description || job.snippet}`);
  const skills = (p.skills ?? []).filter(Boolean);
  const kept = new Set(keep.map((x) => x.toLowerCase()));
  const lower = skills.map((s) => s.toLowerCase());
  const repeated = (s: string, i: number) => lower.indexOf(s.toLowerCase()) !== i; // the same skill written twice
  const needed = (s: string) => named.some((n) => covers(s, n) || covers(n, s));
  // the field of the job and of the person: the lists of both are theirs
  const fields = new Set([fieldFromText(`${job.title} ${job.tags.join(" ")}`), fieldFromText(p.jobTitle ?? "")].filter(Boolean) as Exclude<LookField, "general">[]);
  const own = new Set([...EVERY_CAREER, ...Array.from(fields).flatMap((f) => OWN_LISTS[f] ?? [])]);
  // with no field known nothing can be called far from it
  const far = (s: string) => {
    if (fields.size === 0) return false;
    const list = suggestedGroup(s);
    return !!list && !own.has(list);
  };
  const repeats = skills.filter((s, i) => !kept.has(s.toLowerCase()) && repeated(s, i));
  const unrelated = skills.filter((s, i) => !kept.has(s.toLowerCase()) && !repeated(s, i) && !needed(s) && far(s)).reverse();
  // never more than a quarter of the skills, and never below MIN_SKILLS
  const room = Math.max(0, Math.min(skills.length - MIN_SKILLS, Math.floor(skills.length / 4)));
  const cutSkills = Array.from(new Set([...repeats, ...unrelated])).slice(0, room);

  // A long list (more than LONG_SKILL_LIST) on a crowded resume: the least necessary ones are shown to be REVIEWED, never removed on
  // their own. Ranked from the most to the least dispensable: a skill that repeats another one in the list, a generic one (soft skills,
  // office tools) the job does not ask for, and any other skill the job does not ask for; the end of the list first.
  const review: ReviewSkill[] = [];
  if (skills.length > LONG_SKILL_LIST) {
    const taken = new Set(cutSkills.map((x) => x.toLowerCase()));
    const rank = (s: string): { r: number; item: ReviewSkill } | null => {
      if (kept.has(s.toLowerCase()) || taken.has(s.toLowerCase()) || needed(s)) return null;
      const base = baseSkills(s).find((b) => lower.includes(b.toLowerCase()));
      if (base) return { r: 3, item: { skill: s, why: "repeats", of: skills.find((x) => x.toLowerCase() === base.toLowerCase()) ?? base } };
      const list = suggestedGroup(s);
      if (EVERY_CAREER.includes(list) && list !== "Languages") return { r: 2, item: { skill: s, why: "generic" } };
      if (list === "Languages") return null; // a language is never "unnecessary"
      return { r: 1, item: { skill: s, why: "notAsked" } };
    };
    const ranked = skills
      .map((s, i) => ({ i, x: rank(s) }))
      .filter((e): e is { i: number; x: { r: number; item: ReviewSkill } } => e.x !== null)
      .sort((a, b) => b.x.r - a.x.r || b.i - a.i);
    // enough to bring the list down to LONG_SKILL_LIST, at most eight, and the list never goes below MIN_SKILLS
    const many = Math.max(0, Math.min(8, skills.length - LONG_SKILL_LIST, skills.length - MIN_SKILLS - cutSkills.length));
    review.push(...ranked.slice(0, many).map((e) => e.x.item));
  }

  const jobs = newestFirst(p.jobHistory ?? [])
    .slice(MIN_RECENT_JOBS)
    .reverse()
    .slice(0, 3)
    .map((j) => ({ id: j.id, title: j.title, company: j.company, start: (j.startDate ?? "").slice(0, 4), end: j.current ? "" : (j.endDate ?? "").slice(0, 4) }));
  return { skills: cutSkills, jobs, review };
}

export const pageNote = (fit: PageFit | null, p?: ProfileData, template?: string) =>
  fit ? { pages: fit.pages, scale: fit.scale, maxPages: fit.maxPages ?? 1, crowded: !passesPage(fit), ...(p && template ? { layout: layoutFacts(p, template, fit) } : {}) } : null;
/** What the AI is told about the page and the look of one resume. */
export type PageNote = NonNullable<ReturnType<typeof pageNote>>;

export const postingText = (job: JobListing) =>
  [`Title: ${job.title}`, `Company: ${job.company}`, job.location ? `Location: ${job.location}` : "", job.tags.length ? `Tags: ${job.tags.join(", ")}` : "", `Description: ${job.description || job.snippet}`, job.source === "careerjet" ? "Note: only the first lines of this posting are available. Use only what is written here: do not assume or invent other requirements, tools or duties." : ""].filter(Boolean).join("\n");

/** The language the person reads these in: the app's language. */
export const speak = (lang: ResumeLang) => (lang === "es" ? "Write everything in neutral Latin American Spanish (use tú)." : "Write everything in English.");

/**
 * The AI did not give an answer that can be used (it came back empty, cut short or not as JSON). This is a failure the person is told
 * about and can retry, NOT the same as "there is nothing to say": an empty list of questions is `{ "questions": [] }`, not nothing.
 */
export class AiAnswerError extends Error {
  constructor(message = "The AI did not answer this time.") {
    super(message);
    this.name = "AiAnswerError";
  }
}

/** `expect` is the key the answer must have (so a reply without it counts as a failure). */
async function askJson(system: string, user: unknown, max: number, model: string = AI_MODEL, expect?: string): Promise<Record<string, unknown>> {
  const completion = await getOpenAIChatCompletionWithFallback({
    model,
    temperature: 0, // the same resume and job get the same review
    max_tokens: max,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) },
    ],
  });
  let raw: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(completion.content);
    raw = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    raw = {};
  }
  if (expect && !(expect in raw)) throw new AiAnswerError();
  return raw;
}

const QUESTIONS = `You help a job seeker fit ONE job. You receive their resume as JSON and the job posting.
Find up to 3 requirements that the posting EXPLICITLY asks for (a certification or license, a specific tool or technology, years in an area, a language, a way of working) and that the resume does NOT show, but that the person may truly have. Do not ask about nice-to-haves, soft traits, or things any person with that job title obviously has. Ask each as one short yes/no question in the second person ("Have you ...?").
For each question give:
- "label": the short name of the thing (for example "Docker", "PMP certification", "3 years leading small teams");
- "where": "skill" when it is a tool, technology, method or language that goes in the list of skills; "certification" when it is a certificate or license (the label is its name); "highlight" for anything else (years in an area, a kind of work, an industry).
Do not ask about anything the resume already shows, nor about the skills in "alreadyAsked". Do not ask about the person's age, nationality, health or family. If the resume already covers what the posting explicitly asks, return an empty list.
Reply with ONE JSON object and nothing else: { "questions": [ { "text": "<question>", "label": "<short name>", "where": "skill" | "certification" | "highlight" } ] }`;

/** Fingerprints of the prompts: the answers kept for an old prompt are not used for a new one. */
export const QUESTIONS_VERSION = promptVersion(QUESTIONS);

export interface CoachQuestion {
  text: string;
  label: string;
  where: "skill" | "certification" | "highlight";
}

/** Up to three questions about what the posting explicitly asks and the resume lacks. A "yes" goes to the place `where` says. */
export async function questionsFor(profile: ProfileData, job: JobListing, missingSkills: string[], lang: ResumeLang): Promise<CoachQuestion[]> {
  const raw = await askJson(`${QUESTIONS}\n${speak(lang)}`, { resume: profileForReview(profile), jobPosting: postingText(job), alreadyAsked: missingSkills.slice(0, 20) }, 1500, AI_MODEL, "questions");
  const known = new Set([...(profile.skills ?? []), ...missingSkills].map((x) => x.toLowerCase()));
  const out: CoachQuestion[] = [];
  for (const q of Array.isArray(raw.questions) ? raw.questions : []) {
    const text = clip((q as { text?: unknown })?.text, 220);
    const label = clip((q as { label?: unknown })?.label, 80);
    const where = (q as { where?: unknown })?.where;
    if (text.length < 8 || label.length < 2 || (where !== "skill" && where !== "certification" && where !== "highlight")) continue;
    if (where === "skill" && known.has(label.toLowerCase())) continue; // it is already in the list of skills or asked about there
    out.push({ text, label, where });
  }
  return out.slice(0, 3);
}

const EVALUATE = `You are a recruiter and an applicant tracking system (ATS) expert. You judge the resume of a person for ONE job, BEFORE it is tailored. You receive the resume as JSON, the job posting, the skills and facts the person confirmed they really have for this job ("confirmed"), and the job's level.
Judge it on three things:
1. Requirements: does the resume (plus what the person confirmed) cover what the posting requires (skills, tools, experience, education, languages)?
2. ATS: standard section names and wording, the posting's keywords where they are TRUE for the person, skills written the way the posting writes them, simple structure.
3. Achievement bullets in the XYZ formula ("Accomplished [X] as measured by [Y], by doing [Z]"): do the bullets say what was achieved, how much, and how? Point out the weakest bullets by job and say how to rewrite them using ONLY facts that exist.
Your opinion must come from THIS posting's job title, level and field, and from the format the person chose: "page.layout" gives the look ("family": ats-safe, one-column, two-column or form), the length chosen ("lengthChoice": one, two or kaizo = Kaizo decides) and the pages used. Rules for that:
- Name the job title or its field in the improvements: a software role asks for stack, scale and metrics; a nursing role for licenses, units and ratios; a sales role for quota and revenue; and so on. Two different postings must get different advice.
- Look "ats-safe": do not mention parsing risks. Any other look: make sure the posting's keywords also sit in plain text (objective, bullets, skills), not only in a graphic or a rating.
- Never ask to cut content just to reach one page when "page.maxPages" is 2: the person chose a longer resume. Cut only when "page.crowded" is true. If page.layout.pagesNow is 2 and page.layout.lastPageFill is under 0.3, say that the second page is nearly empty and should be tightened or strengthened with what THIS job values.
- Judge length against the level of the job: entry-level and junior postings fit a tight one page; senior and research postings can justify two.
Use ONLY facts in the data. Never invent numbers, tools or experience.
If "page" says the resume is crowded (more pages than "maxPages", or the text would have to shrink below 85%, which a recruiter skips as small print), one of the improvements must say what to cut for this job: less relevant skills or older jobs, never the 3 most recent jobs.
"today" is the current date: a date on or before it is in the past or the present, never "in the future". Do not point at dates as mistakes unless they are after "today" or end before they start.
The number (score) is measured by code, so you do not give one.
Reply with ONE JSON object and nothing else:
{
  "headline": "<one sentence: where the person stands for this job>",
  "strengths": ["<up to 4 short items: what already fits>"],
  "improvements": [ { "text": "<a short, concrete item the tailoring should do or the person should add>", "kind": "keywords" | "bullets" | "objective" | "requirement" | "other", "terms": ["<only for kind keywords>"], "jobId": "<id of the job, only for kind bullets>" } ]
}
"improvements": up to 5, most useful first. "kind" says what the item is about: "keywords" for posting terms to work into the objective or the bullets, "bullets" for weak bullets, "objective" for the profile paragraph, "requirement" for something the posting asks and the resume lacks, "other" for the rest. For kind "keywords", "terms" is REQUIRED (if you cannot name the exact terms, use another kind) and lists the exact words or short phrases, copied as the POSTING writes them, that are TRUE for the person (the resume or "confirmed" shows them) and that the objective and the bullets do not say yet. Code checks every term against the posting and the resume, and drops what is already said.
When "previous" is given, this is a re-check of the same resume: it lists what you said last time ("improvements") and the changes already made for it ("applied"). The objective and the bullets of the jobs in "fixed" were just rewritten for this job: do not raise them again unless the CURRENT text clearly fails what the posting needs, and then say what is still missing. Do not repeat an item that those changes already carried out. Keep the wording of an item that still stands, and add only what is new.`;

/**
 * What an earlier review of the same resume for the same job left behind, so a new review does not start from zero: what it listed, the
 * changes the person had made for it ("Fix all") and which parts those changes already rewrote.
 */
export interface ReviewMemory {
  improvements: string[];
  applied: string[];
  fixed: { objective: boolean; jobTitle: boolean; jobIds: string[] };
}

/** The memory the page sends, cleaned: short texts, and only job ids that exist in the resume. */
export function cleanMemory(input: unknown, profile: ProfileData): ReviewMemory | undefined {
  if (!input || typeof input !== "object") return undefined;
  const r = input as { improvements?: unknown; applied?: unknown; fixed?: { objective?: unknown; jobTitle?: unknown; jobIds?: unknown } };
  const texts = (v: unknown, n: number, len: number) => (Array.isArray(v) ? v : []).map((x) => clip(x, len)).filter(Boolean).slice(0, n);
  const ids = new Set((profile.jobHistory ?? []).map((j) => j.id));
  const memory: ReviewMemory = {
    improvements: texts(r.improvements, 8, 260),
    applied: texts(r.applied, 20, 160),
    fixed: {
      objective: r.fixed?.objective === true,
      jobTitle: r.fixed?.jobTitle === true,
      jobIds: texts(r.fixed?.jobIds, 30, 80).filter((id) => ids.has(id)),
    },
  };
  return memory.improvements.length || memory.applied.length || memory.fixed.objective || memory.fixed.jobTitle || memory.fixed.jobIds.length ? memory : undefined;
}

export const EVALUATE_VERSION = promptVersion(EVALUATE);

export interface Evaluation {
  headline: string;
  strengths: string[];
  improvements: string[];
  /** the keywords the review asked to work in, checked by code: in the posting, true for the person, not said yet. The score counts them. */
  targets: string[];
}

export async function evaluateDraft(profile: ProfileData, job: JobListing, confirmed: { skills: string[]; facts: string[] }, level: string, lang: ResumeLang, page: PageNote | null = null, memory?: ReviewMemory): Promise<Evaluation> {
  const raw = await askJson(`${EVALUATE}\n${speak(lang)}`, { today: new Date().toISOString().slice(0, 10), resume: profileForReview(profile), jobPosting: postingText(job), confirmed, level, ...(page ? { page } : {}), ...(memory ? { previous: { improvements: memory.improvements, applied: memory.applied, fixed: memory.fixed } } : {}) }, 3000, AI_MODEL_STRONG, "improvements");
  const list = (v: unknown, n: number) => (Array.isArray(v) ? v : []).map((x) => clip(x, 260)).filter((x) => x.length > 3).slice(0, n);
  // The improvements are checked by code. A "keywords" one is kept only while some of its terms are really in the posting, are true for
  // the person (the resume or what they confirmed shows them) and are not said yet in the objective or the bullets: once the resume says
  // them the item is gone, and the number moves with it.
  const posting = postingText(job).toLowerCase();
  const own = `${resumeText(profile)} ${[...confirmed.skills, ...confirmed.facts].join(" ").toLowerCase()}`;
  const said = narrativeText(profile);
  const targets: string[] = [];
  const improvements: string[] = [];
  // what the posting names, the resume has (anywhere) and the objective and bullets do not say yet
  const derived = mentionedSkills(posting).filter((t) => own.includes(t.toLowerCase()) && !saysTerm(said, t)).slice(0, 6);
  for (const item of Array.isArray(raw.improvements) ? raw.improvements : []) {
    const obj = item && typeof item === "object" ? (item as { text?: unknown; kind?: unknown; terms?: unknown }) : null;
    const text = clip(obj ? obj.text : item, 260);
    if (text.length <= 3) continue;
    // what the person already had rewritten is not raised again, whatever the AI says: the objective, the title and the bullets of the
    // jobs that "Fix all" carried out (the fixes were checked before they were applied)
    if (memory) {
      const kind = (obj as { kind?: unknown } | null)?.kind;
      const jobId = clip((obj as { jobId?: unknown } | null)?.jobId, 80);
      if (kind === "objective" && memory.fixed.objective) continue;
      if (kind === "bullets" && jobId && memory.fixed.jobIds.includes(jobId)) continue;
    }
    let shown = text;
    if (obj?.kind === "keywords") {
      const named = (Array.isArray(obj.terms) ? obj.terms : []).map((t) => clip(t, 60)).filter((t) => t.length >= 2);
      let terms = named.filter((t) => posting.includes(t.toLowerCase()) && own.includes(t.toLowerCase()) && !saysTerm(said, t));
      // the AI often says "work the keywords in" without naming any: then the code names them, from what the posting asks and the
      // resume has but does not say yet. When it did name them and none is left (said already, or not true), there is nothing to do.
      if (named.length === 0) terms = derived;
      if (terms.length === 0) continue;
      for (const t of terms) if (!targets.some((x) => x.toLowerCase() === t.toLowerCase())) targets.push(t);
      // the item names the words, so the person knows exactly what is meant
      const missing = terms.filter((t) => !text.toLowerCase().includes(t.toLowerCase()));
      if (missing.length) shown = `${text.replace(/[.\s]+$/, "")}: ${missing.slice(0, 6).join(", ")}.`.slice(0, 260);
    }
    improvements.push(shown);
    if (improvements.length >= 5) break;
  }
  return { headline: clip(raw.headline, 300), strengths: list(raw.strengths, 4), improvements, targets: targets.slice(0, 12) };
}

const FIX_ALL = `You are an expert resume writer improving the resume of a person for ONE job, for a US applicant tracking system (ATS) and recruiters.
You receive the resume as JSON, the job posting, a list of "improvements" a reviewer asked for, the facts and skills the person confirmed ("confirmed"), sometimes "keywords" (posting terms the resume should say) and sometimes "page" (whether the resume is crowded, and its look and length in "page.layout"). Write for the job title and its field, and never cut content to reach one page when "page.maxPages" is 2.
"keywords": work each one into the objective (and into a bullet of a job only where it is already true for that job), written exactly as given. The objective is the safest place: it speaks of the person as a whole.
Reply with ONE JSON object and nothing else: { "fixes": [ <fix>, ... ] } where each fix is exactly one of:
  { "type": "objective", "text": "<3 to 5 sentences, 250 to 700 characters, no 'I', written for this job>" }
  { "type": "jobTitle", "text": "<the title the resume should show>" }
  { "type": "bullets", "jobId": "<id from the data>", "bullets": ["<the FULL replacement list of bullets of that job>"] }
  { "type": "addSkills", "skills": ["<skills>"] }
  { "type": "removeSkills", "skills": ["<skills exactly as in the data>"] }
Rules:
- Never name the company the person is applying to in the objective or in a bullet: the resume must work for any similar job. Name the kind of role, not the employer.
- Do what the improvements ask, and only that. Skip an improvement you cannot do with the facts available.
- Use only facts in the resume or in "confirmed". Never invent employers, dates, tools, degrees, metrics or numbers. Never give a job duties, tools or skills it does not already show: rewrite what that job says (a driving job stays a driving job, even when the posting is for software), and never copy the posting's keywords into a job where they are not true. Where a bullet has no number, make the verb and the result clearer without adding one.
- Bullets: 25 to 170 characters, a strong action verb first (past tense, present for the current job), no first person, XYZ form (achieved X, measured by Y, by doing Z) when the data allows it. Use the posting's keywords only where they are true for the person.
- addSkills: only skills clearly shown by the resume's jobs, projects or studies, or in "confirmed". removeSkills: only exact repeats of another skill. Skills are a priority: never remove an important one.
- Plain language, no emojis, no markdown.`;

/** Structured fixes (the ones the resume review uses) that carry out what a review of the draft asked for. They change only the draft. */
export async function fixesFor(
  profile: ProfileData,
  job: JobListing,
  improvements: string[],
  confirmed: { skills: string[]; facts: string[] },
  lang: ResumeLang,
  page: PageNote | null,
  keywords: string[] = []
): Promise<ReviewFix[]> {
  const raw = await askJson(`${FIX_ALL}\n${speak(lang)}`, { today: new Date().toISOString().slice(0, 10), resume: profileForReview(profile), jobPosting: postingText(job), improvements, confirmed, ...(keywords.length ? { keywords } : {}), ...(page ? { page } : {}) }, 5000, AI_MODEL_STRONG, "fixes");
  // what the resume itself shows: only those skills may be added (plus the ones the person confirmed)
  const shown = new Set([...mentionedSkills(resumeText(profile)), ...confirmed.skills].map((s) => s.toLowerCase()));
  const allowed = new Set(["objective", "jobTitle", "bullets", "addSkills", "removeSkills"]);
  const out: ReviewFix[] = [];
  for (const f of Array.isArray(raw.fixes) ? raw.fixes : []) {
    if (!f || typeof f !== "object" || !allowed.has(String((f as { type?: unknown }).type))) continue;
    const fix = cleanFix(f, profile);
    if (!fix) continue;
    // the objective and the bullets are for a kind of role, never for the employer of this posting
    if (fix.type === "objective") {
      const text = withoutEmployer(fix.text, job.company);
      if (text.length < 120) continue;
      fix.text = text;
    }
    if (fix.type === "bullets" && fix.bullets.some((b) => namesEmployer(b, job.company))) continue;
    if (fix.type === "removeSkills") {
      // "fix all" only takes out repeats (a skill written twice, or one built on another that is also listed); skills the job does not
      // need are offered separately, one by one, when the page is crowded
      const list = (profile.skills ?? []).map((x) => x.toLowerCase());
      const skills = fix.skills.filter((x) => list.filter((y) => y === x.toLowerCase()).length > 1 || baseSkills(x).some((b) => list.includes(b.toLowerCase())));
      if (skills.length) out.push({ type: "removeSkills", skills });
    } else if (fix.type === "addSkills") {
      const skills = fix.skills.filter((s) => shown.has(s.toLowerCase()));
      if (skills.length) out.push({ type: "addSkills", skills });
    } else if (fix.type === "bullets") {
      // the new bullets may say the same better, but not more: one that adds a tool or a number the job never showed goes back
      // as the person wrote it (and when nothing is left of the rewrite, the fix is dropped)
      const job = (profile.jobHistory ?? []).find((j) => j.id === fix.jobId);
      if (!job) continue;
      const checked = faithfulBullets(job, fix.bullets, [...confirmed.skills, ...confirmed.facts].join(" "));
      if (checked.bullets.length >= 2 && JSON.stringify(checked.bullets) !== JSON.stringify(job.accomplishments ?? [])) out.push({ type: "bullets", jobId: fix.jobId, bullets: checked.bullets });
    } else out.push(fix);
  }
  return out.slice(0, 8);
}

const LEVEL_OBJECTIVE = `You rewrite the career objective (the profile paragraph) of a resume so that it states the person's level as part of the story.
You receive the resume as JSON, the current objective (may be empty), the level to state ("Entry level", "Junior", "Mid-level" or "Senior"), the job the person is applying to, and the language of the resume.
Reply with ONE JSON object and nothing else: { "objective": "<the rewritten objective>" }
Rules:
- Work the level into the text where it reads naturally (for example "Junior full stack developer with…", "Entry-level analyst who…", "Senior engineer with…"), not as a label stuck in front.
- Keep what the current objective says that is true and useful; improve the rest. When it is empty, write it from the resume.
- 3 to 5 sentences, 250 to 700 characters, no first person ("I"), tied to the job when it fits.
- Use ONLY facts in the resume. Never invent employers, years, tools, degrees or numbers.
- Never name the company the person is applying to: the objective is for a kind of role, not for one employer.
- Write it in the language of the current objective or, if it is empty, of the resume. Plain language, no emojis, no markdown.`;

export const OBJECTIVE_VERSION = promptVersion(LEVEL_OBJECTIVE);

/** The objective rewritten with the level inside it. Returns null if the answer is not usable. */
export async function objectiveWithLevelAi(profile: ProfileData, job: JobListing, levelLabel: string, lang: ResumeLang): Promise<string | null> {
  const raw = await askJson(`${LEVEL_OBJECTIVE}\n${speak(lang)}`, { resume: profileForReview(profile), currentObjective: profile.careerObjective ?? "", level: levelLabel, job: { title: job.title, company: job.company } }, 2000, AI_MODEL_STRONG, "objective");
  const text = withoutEmployer(clip(raw.objective, 800), job.company);
  return text.length >= 120 ? text : null;
}

const SKILLS_SHOWN = `You read a resume and say which of the listed skills it ALREADY shows, so the person is not asked about them.
You receive the resume as JSON (its skills, jobs, projects, studies, certifications and objective) and "skills": the skills a job asks for that were not found by simple matching.
A skill counts as shown when the resume clearly evidences it in any part: the same skill under another name ("JS" for JavaScript, "Postgres" for PostgreSQL), a tool that implies it ("Django" shows Python, "Spring Boot" shows Java), or work that is obviously that skill ("ran daily stand-ups and sprints" shows Agile/Scrum).
Be strict: if the evidence is weak, vague or only a guess, the skill is NOT shown. For every skill you say is shown, copy a short exact phrase (2 to 12 words) from the resume that proves it.
Reply with ONE JSON object and nothing else: { "shown": [ { "skill": "<skill exactly as listed>", "quote": "<exact phrase from the resume>" } ] }`;

export const SHOWN_VERSION = promptVersion(SKILLS_SHOWN);

export interface ShownSkill {
  skill: string;
  quote: string;
}

/** The skills among `missing` that the resume already shows. Each one must come with a phrase that really is in the resume. */
export async function skillsAlreadyShown(profile: ProfileData, missing: string[]): Promise<ShownSkill[]> {
  if (missing.length === 0) return [];
  const raw = await askJson(SKILLS_SHOWN, { resume: profileForReview(profile), skills: missing }, 1500, AI_MODEL, "shown");
  const squash = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
  const text = squash(`${resumeText(profile)} ${(profile.skills ?? []).join(" ")}`);
  const byName = new Map(missing.map((m) => [m.toLowerCase(), m]));
  const out: ShownSkill[] = [];
  for (const row of Array.isArray(raw.shown) ? raw.shown : []) {
    const skill = byName.get(clip((row as { skill?: unknown })?.skill, 60).toLowerCase());
    const quote = clip((row as { quote?: unknown })?.quote, 160);
    // the proof must be in the resume itself: a made-up phrase does not count
    if (skill && quote.length >= 2 && text.includes(squash(quote)) && !out.some((x) => x.skill === skill)) out.push({ skill, quote });
  }
  return out;
}

const GROUP_SKILLS = `A resume lists its skills in groups (for example "Languages", "Frameworks", "Tools"). You receive "groups": each existing group with the skills already in it, and "newSkills": skills just added to the resume.
For each new skill, say in which group it goes, judging by what the skills of each group are. Use an EXISTING group whenever one fits, written exactly as it is. If the resume uses groups but none fits a skill, you may give a new group name of 1 to 3 words in the same language as the existing names (for example "Cloud"). If you cannot tell, leave the group empty.
Reply with ONE JSON object and nothing else: { "placements": [ { "skill": "<skill exactly as given>", "group": "<group>" } ] }`;

/** The group each new skill goes in, following the groups the resume already has. */
export async function groupsForNewSkills(profile: ProfileData, newSkills: string[]): Promise<Record<string, string>> {
  const groups: Record<string, string[]> = {};
  for (const sk of profile.skills ?? []) {
    const g = (profile.skillGroups?.[sk] ?? "").trim();
    if (g && !newSkills.includes(sk)) (groups[g] ??= []).push(sk);
  }
  if (Object.keys(groups).length === 0 || newSkills.length === 0) return {};
  const raw = await askJson(GROUP_SKILLS, { groups, newSkills }, 1200, AI_MODEL, "placements");
  const byName = new Map(newSkills.map((x) => [x.toLowerCase(), x]));
  const existing = new Map(Object.keys(groups).map((g) => [g.toLowerCase(), g]));
  const out: Record<string, string> = {};
  for (const row of Array.isArray(raw.placements) ? raw.placements : []) {
    const skill = byName.get(clip((row as { skill?: unknown })?.skill, 60).toLowerCase());
    const group = clip((row as { group?: unknown })?.group, 40);
    if (skill && group) out[skill] = existing.get(group.toLowerCase()) ?? group;
  }
  return out;
}

/** The language of the posting when it is clear, otherwise the one given. */
export const languageFor = (job: JobListing, fallback: ResumeLang): ResumeLang => jobLang(`${job.title}. ${job.description || job.snippet}`) ?? fallback;
