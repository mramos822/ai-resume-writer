"use client";

// A resume for one job, made in a full page like the resume builder: you say what you have, edit the details for this job with the
// live preview next to you, see how it reads for the job, and then it is created. Everything you edit here is a copy for this job:
// the saved profile never changes.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { ArrowLeft, Check, ChevronDown, Languages, LayoutTemplate, Loader2, Palette, Scissors, Sparkles, Trash2, TriangleAlert, Undo2, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import LivePreview from "@/components/livePreview";
import CompanyLogo from "@/components/companyLogo";
import { Ring, YesNo } from "@/components/applicationParts";
import ContactInfoSection from "@/components/profile/contactInfoSection";
import CareerObjectiveSection from "@/components/profile/careerObjectiveSection";
import SkillsSection from "@/components/profile/skillsSection";
import JobHistorySection from "@/components/profile/jobHistorySection";
import EducationSection from "@/components/profile/educationSection";
import ExtrasEditor from "@/components/extrasEditor";
import SkillLevelPicker from "@/components/skillLevelPicker";
import SkillGroupsEditor from "@/components/skillGroupsEditor";
import TemplateSelector from "@/components/templateSelector";
import { loadTemplates } from "@/lib/templatePreload";
import AccentPicker from "@/components/accentPicker";
import PageLengthPicker from "@/components/pageLengthPicker";
import { asPageGoal, canRunTwoPages } from "@/lib/pageGoal";
import ExperienceLevelPicker from "@/components/experienceLevelPicker";
import { useProfile, type ProfileData } from "@/context/profileContext";
import { useToast } from "@/context/toastContext";
import { authFetch } from "@/lib/authFetch";
import { asTemplateId } from "@/lib/templates";
import { APPLY_JOB_KEY } from "@/lib/applyJob";
import { jobScore } from "@/lib/jobScore";
import { levelOf } from "@/lib/jobLevel";
import { baseSkills, covers, skillGap } from "@/lib/jobSkills";
import { previewFromProfile } from "@/lib/previewData";
import { yearsFor, asLevel, inferLevel, levelMatchesJob, type Level } from "@/lib/experienceLevel";
import { resumeText } from "@/lib/roleProfile";
import { applyFixes, patchChangesProfile, snapshotFor, type ProfilePatch, type ReviewFix } from "@/lib/resumeReview";
import type { JobListing } from "@/lib/jobSearch";
import type { LookAdvice, LookField } from "@/lib/templateAdvice";
import { PAGE_MIN_SCALE } from "@/lib/pageRules";
import { cleanSkillGroups, hasSkillGroups } from "@/lib/skillGroups";
import { autoGroupSkills, suggestedGroup } from "@/lib/skillCategories";
import { motion } from "framer-motion";
import { resumeLangForJob } from "@/lib/resumeLang";
import { detectResumeLanguage } from "@/lib/resumeTranslate";
import { translateProfile } from "@/utils/translateClient";
import { useHidePageScrollbar } from "@/lib/useHidePageScrollbar";
import { useT } from "@/i18n/provider";

interface Question {
  text: string;
  /** the short name of what is asked, and where a "yes" goes: the skills, the certifications, or only the objective and the letter */
  label: string;
  where: "skill" | "certification" | "highlight";
  yes: boolean | null;
  note: string;
}
interface Evaluation {
  /** the keywords the review asked to work in (checked by the server): the number counts them */
  targets?: string[];
  headline: string;
  strengths: string[];
  improvements: string[];
}
interface PageInfo {
  pages: number | null;
  scale: number | null;
  /** pages the person accepts for this look (1 or 2) */
  maxPages?: number;
  crowded: boolean;
  cut: { skills: string[]; jobs: { id: string; title: string; company: string; start: string; end: string }[]; review: { skill: string; why: "repeats" | "generic" | "notAsked"; of?: string }[] };
}

/** How much the banner shrinks when the page is scrolled. */
const BANNER_SHRINK = 0.8;

const SECTIONS = ["objective", "skills", "jobs", "education", "projects", "internships", "links", "languages", "contact"] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_LABEL: Record<Section, string> = { objective: "Objective", skills: "Skills", jobs: "Jobs", education: "Education", projects: "Projects", internships: "Internships", links: "Links", languages: "Languages", contact: "Contact" };

const CREATING = ["Reading the job posting", "Tailoring your resume to it", "Writing your cover letter", "Saving everything"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ApplyWorkspace({ job, profileId }: { job: JobListing; profileId: string }) {
  useHidePageScrollbar(); // the scrollbar of the whole page is not drawn here (the page still scrolls)
  const { tr, locale } = useT();
  const router = useRouter();
  const toast = useToast();
  const { activeProfile: draft, updateSkills, updateSkillGroups: setSkillGroups, updateCertifications, updateLanguages, updateAccentColor, updateFillPage, updatePageGoal, updateCareerObjective, updateJobTitle, setJobHistory, updateSkillLevels, updateSkillGroups, setEducation, updateInterests, updateProjectEntry, updateInternshipEntry } = useProfile();

  const [step, setStep] = useState<"fit" | "edit" | "review">("fit");
  const [section, setSection] = useState<Section>("objective");
  const [skillMode, setSkillMode] = useState<"relevant" | "all">("relevant");
  const [skillAnswer, setSkillAnswer] = useState<Record<string, boolean>>({});
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState(false);
  const [mentionLevel, setMentionLevel] = useState(false); // write the level in the objective of this resume
  const [truthful, setTruthful] = useState(false);
  const [creating, setCreating] = useState<number | null>(null); // the step of the creation, while it runs
  const [error, setError] = useState("");

  // The language of this job (its text, else its country, else the app's) and the one the resume is in. When they differ the person can translate
  // the resume to the job's language, for this resume only: what it was is kept to go back, and put back if the page is left.
  const jobLanguage = resumeLangForJob(job, locale);
  const draftLanguage = detectResumeLanguage(draft);
  const [translation, setTranslation] = useState<{ original: Partial<ProfileData> } | null>(null);
  const [translating, setTranslating] = useState(false);
  const translationRef = useRef(translation);
  translationRef.current = translation;
  const applyFields = (p: Partial<ProfileData>) => {
    updateJobTitle(p.jobTitle ?? "");
    updateCareerObjective(p.careerObjective ?? "");
    setJobHistory(p.jobHistory ?? []);
    setEducation(p.education ?? []);
    updateSkills(p.skills ?? []);
    if (p.skillGroups) setSkillGroups(p.skillGroups);
    if (p.skillLevels) updateSkillLevels(p.skillLevels);
    updateLanguages(p.languages ?? []);
    updateInterests(p.interests ?? []);
    updateCertifications(p.certifications ?? []);
    (p.projects ?? []).forEach((x) => updateProjectEntry(x.id, x));
    (p.internships ?? []).forEach((x) => updateInternshipEntry(x.id, x));
  };
  const applyFieldsRef = useRef(applyFields);
  applyFieldsRef.current = applyFields;
  const languageName = (code: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  const placeName = (() => {
    try {
      return job.country ? new Intl.DisplayNames([locale], { type: "region" }).of(job.country.toUpperCase()) ?? "" : "";
    } catch {
      return "";
    }
  })();
  const translateToJob = async () => {
    setTranslating(true);
    try {
      const d = draftRef.current;
      const original: Partial<ProfileData> = { jobTitle: d.jobTitle, careerObjective: d.careerObjective, jobHistory: d.jobHistory, internships: d.internships, education: d.education, projects: d.projects, skills: d.skills, skillGroups: d.skillGroups, skillLevels: d.skillLevels, languages: d.languages, interests: d.interests, certifications: d.certifications };
      const translated = await translateProfile(JSON.parse(JSON.stringify(original)), jobLanguage);
      applyFields(translated);
      setTranslation({ original });
      toast.success(tr("Your resume was translated to {language} for this job.", { language: languageName(jobLanguage) }));
    } catch (e) {
      toast.error((e as Error).message || tr("We couldn't translate your resume right now."));
    } finally {
      setTranslating(false);
    }
  };
  const undoTranslation = () => {
    if (translation) applyFields(translation.original);
    setTranslation(null);
  };
  // leaving the page puts the resume back as it was: the translation is for this job only and never reaches the saved profile
  useEffect(
    () => () => {
      if (translationRef.current) applyFieldsRef.current(translationRef.current.original);
    },
    []
  );

  // the look of the resume: the one the person uses, and they can change it at any moment
  const [template, setTemplate] = useState(() => {
    try {
      return asTemplateId(localStorage.getItem("kaizo_template"));
    } catch {
      return asTemplateId(null);
    }
  });
  const changeTemplate = useCallback((id: string) => {
    const t = asTemplateId(id);
    setTemplate(t);
    try {
      localStorage.setItem("kaizo_template", t);
    } catch {
      /* storage unavailable: it still applies to this resume */
    }
  }, []);
  const [customizing, setCustomizing] = useState(false); // the looks and the color, as in the resume builder
  // the banner shrinks as soon as the page scrolls a little, and grows again at the top (with a margin, so it does not flicker at the edge)
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => setCompact((c) => (c ? window.scrollY > 6 : window.scrollY > 36));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // the looks (and their pictures) start loading as the page opens, so "Customize" shows them at once
  useEffect(() => {
    loadTemplates().catch(() => {});
  }, []);

  // the banner: the content is only scaled and the background is its own layer, so the width and the space it takes in the page never change
  const bannerContent = useRef<HTMLDivElement>(null);
  const [bannerH, setBannerH] = useState(0);
  useLayoutEffect(() => {
    const el = bannerContent.current;
    if (!el) return;
    const read = () => setBannerH(el.offsetHeight);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  // the saved profile as it was when this page opened: the fit "before" and the skills that are missing come from it
  const saved = useRef(draft);
  const posting = `${job.title}. ${job.tags.join(", ")}. ${job.description || job.snippet}`;
  // a skill the resume already shows (in the list of skills, or in a job, a project or a study; "JS" counts as JavaScript) is not asked about
  const gap = useMemo(() => skillGap(posting, saved.current.skills ?? [], resumeText(saved.current)), [posting]);
  const [shownSkills] = useState<string[]>(() => gap.fromText ?? []);
  // The skills the experience mentions (in a job, a project or a study) but the list of skills does not have are NOT added by themselves: the
  // person is asked about each one ("Your experience mentions these skills"), and only a "yes" puts it on this resume. They still count for the
  // fit as evidence, whatever the answer.
  const [foundAnswer, setFoundAnswer] = useState<Record<string, boolean>>({});
  const foundNames = useRef<string[]>([...shownSkills]);

  // before asking "do you have these skills?" the AI reads the resume: the ones it already shows are marked as had and not asked
  const [checking, setChecking] = useState(gap.missing.length > 0);
  const [aiHave, setAiHave] = useState<{ skill: string; quote: string }[]>([]);
  const missing = useMemo(() => gap.missing.filter((s) => !aiHave.some((h) => h.skill === s)), [gap.missing, aiHave]);
  // what the experience mentions and the list of skills does not have (asked about, never added by itself), with the phrase that shows it
  const foundList = useMemo(() => {
    const out: { skill: string; quote?: string }[] = aiHave.map((h) => ({ skill: h.skill, quote: h.quote }));
    for (const sk of shownSkills) if (!out.some((o) => o.skill.toLowerCase() === sk.toLowerCase())) out.push({ skill: sk });
    return out;
  }, [aiHave, shownSkills]);
  // the skills of the list (of this draft: the saved ones and the ones confirmed here): only these are "already yours"
  const listedNow = (sk: string) => (draft.skills ?? []).some((m) => covers(m, sk));
  const haveChips = gap.matched.filter(listedNow);
  const aiChips = aiHave.filter((h) => listedNow(h.skill));
  // "SQL Server" when the resume has "SQL": not a full question, only a tap, because the person already has the base of it
  const baseOf = (skill: string) => baseSkills(skill).find((b) => (saved.current.skills ?? []).some((m) => m.toLowerCase() === b.toLowerCase()));
  const related = useMemo(() => missing.filter((s) => baseOf(s)), [missing]);
  const unrelated = useMemo(() => missing.filter((s) => !baseOf(s)), [missing]);
  // A skill that is added always goes in a group (a "list" of skills):
  //  - if the resume already uses groups ("Languages", "Tools"...), the AI reads them and puts it in the one that fits;
  //  - if it does not, the default lists decide (programming languages, frameworks, databases, tools... or the field of the skill).
  // When the AI cannot place one, the default list does.
  const placeSkills = (added: string[]) => {
    if (added.length === 0) return;
    setTimeout(async () => {
      const skillsNow = () => draftRef.current.skills ?? [];
      const byDefault = (groups: Record<string, string>) => {
        const next = { ...groups };
        for (const sk of added) {
          const g = suggestedGroup(sk);
          if (g && !(next[sk] ?? "").trim()) next[sk] = tr(g);
        }
        return cleanSkillGroups(skillsNow(), next);
      };
      if (!hasSkillGroups(skillsNow(), draftRef.current.skillGroups)) {
        // no groups yet: all the skills are sorted by the default lists, so the new one is not alone in a list
        setSkillGroups(byDefault(autoGroupSkills(skillsNow(), draftRef.current.skillGroups, tr)));
        return;
      }
      let placements: Record<string, string> = {};
      try {
        const res = await authFetch("/api/applications/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "group", profileId, job, newSkills: added, draft: draftPayload(), lang: locale }) });
        if (res.ok) placements = ((await res.json()) as { placements: Record<string, string> }).placements ?? {};
      } catch {
        /* the default lists place them */
      }
      setSkillGroups(byDefault({ ...(draftRef.current.skillGroups ?? {}), ...placements }));
    }, 60);
  };
  const years = yearsFor(draft);
  const level = levelOf(job);
  // Two versions of the objective are ready from the start: the basic one (the person's own) and one with the level written inside it
  // (the AI writes it in the background as the page opens). The choice only swaps between them, so it is instant.
  const levelFor: Level = asLevel(draft.experienceLevel) ?? inferLevel(saved.current).level;
  const [leveled, setLeveled] = useState<{ level: Level; text: string } | null>(null);
  useEffect(() => {
    let off = false;
    setLeveled((cur) => (cur && cur.level === levelFor ? cur : null));
    const { photo: _photo, ...base } = saved.current; // eslint-disable-line @typescript-eslint/no-unused-vars
    authFetch("/api/applications/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "objective", profileId, job, level: levelFor, draft: base, lang: locale }) })
      .then((r) => (r.ok ? r.json() : { objective: null }))
      .then((d: { objective?: string | null }) => !off && d.objective && setLeveled({ level: levelFor, text: d.objective }))
      .catch(() => {});
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFor, job.key]);
  const withLevelReady = !!leveled && leveled.level === levelFor;
  const swapped = useRef<{ before: string; text: string } | null>(null);
  useEffect(() => {
    if (mentionLevel && leveled && leveled.level === levelFor) {
      if (!swapped.current) swapped.current = { before: draftRef.current.careerObjective ?? "", text: leveled.text };
      else swapped.current = { before: swapped.current.before, text: leveled.text };
      if ((draftRef.current.careerObjective ?? "") !== leveled.text) updateCareerObjective(leveled.text);
    } else if (!mentionLevel && swapped.current) {
      const a = swapped.current;
      swapped.current = null;
      // back to the basic one, unless the person has edited the objective since
      if ((draftRef.current.careerObjective ?? "") === a.text) updateCareerObjective(a.before);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionLevel, leveled, levelFor]);

  // the level goes in the objective by default when the job asks for that same level; the person can change it, and then it is left alone
  const mentionTouched = useRef(false);
  const setMention = (v: boolean) => {
    mentionTouched.current = true;
    setMentionLevel(v);
  };
  useEffect(() => {
    const lv = asLevel(draft.experienceLevel);
    if (!mentionTouched.current && lv && levelMatchesJob(lv, level.label)) setMentionLevel(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.experienceLevel]);
  // the same role and skills as the search and the job use, so the fit does not change just by opening this page
  const role = saved.current.jobTitle?.trim() || "";
  
  const extra = useMemo(
    () => [...missing.filter((s) => skillAnswer[s] === true), ...(questions ?? []).filter((q) => q.where === "skill" && q.yes === true).map((q) => q.label), ...Object.keys(foundAnswer).filter((k) => foundAnswer[k])],
    [missing, skillAnswer, questions, foundAnswer]
  );
  // the number of the job (see lib/jobScore) is the same in the ring of the banner and in the one of the review: the banner follows the draft live
  const before = useMemo(() => jobScore(saved.current, job, [], template).score, [job, template]); // eslint-disable-line react-hooks/exhaustive-deps

  const answerFound = (skill: string, yes: boolean) => {
    setFoundAnswer((a) => ({ ...a, [skill.toLowerCase()]: yes }));
    const have = draftRef.current.skills ?? [];
    const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    if (yes && !have.some((x) => same(x, skill))) {
      updateSkills([...have, skill]);
      placeSkills([skill]);
    }
    // a "no" takes it out again, unless it was in the saved profile
    if (!yes) updateSkills(have.filter((x) => !same(x, skill) || (saved.current.skills ?? []).some((y) => same(y, skill))));
  };

  const answerSkill = (s: string, yes: boolean) => {
    setSkillAnswer((a) => ({ ...a, [s]: yes }));
    const have = draftRef.current.skills ?? [];
    if (yes && !have.some((x) => x.toLowerCase() === s.toLowerCase())) {
      updateSkills([...have, s]);
      placeSkills([s]);
    }
    if (!yes) updateSkills(have.filter((x) => x.toLowerCase() !== s.toLowerCase() || (saved.current.skills ?? []).some((y) => y.toLowerCase() === s.toLowerCase())));
  };

  // the questions about what the job asks and the resume does not show: if the AI cannot write them, the person is told and can try again
  // (an empty list means there was nothing to ask; a failure is not the same thing)
  const [questionsFailed, setQuestionsFailed] = useState(false);
  const restForQuestions = useRef<string[]>([]);
  const askQuestions = async (rest: string[], isOff: () => boolean = () => false) => {
    restForQuestions.current = rest;
    setQuestionsFailed(false);
    setQuestions(null);
    try {
      const r = await authFetch("/api/applications/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId, job, lang: locale, action: "questions", missingSkills: rest }) });
      if (!r.ok) throw new Error("questions");
      const d = (await r.json()) as { questions?: { text: string; label: string; where: Question["where"] }[] };
      // (a question about something already listed under "Your experience mentions" would ask it twice)
      const asked = (d.questions ?? []).filter((q) => !foundNames.current.some((f) => `${q.label} ${q.text}`.toLowerCase().includes(f.toLowerCase())));
      if (!isOff()) setQuestions(asked.map((q) => ({ ...q, yes: null, note: "" })));
    } catch {
      if (!isOff()) {
        setQuestions([]);
        setQuestionsFailed(true);
      }
    }
  };

  // as the page opens: first the AI reads the resume (skills already shown), then the questions are asked about what is still missing
  useEffect(() => {
    let off = false;
    const post = (body: Record<string, unknown>) => authFetch("/api/applications/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId, job, lang: locale, ...body }) });
    (async () => {
      let rest = gap.missing;
      if (gap.missing.length > 0) {
        try {
          const r = await post({ action: "shown", missingSkills: gap.missing });
          const d = r.ok ? ((await r.json()) as { shown?: { skill: string; quote: string }[] }) : { shown: [] };
          const shown = d.shown ?? [];
          if (off) return;
          if (shown.length) {
            setAiHave(shown);
            rest = gap.missing.filter((s) => !shown.some((h) => h.skill === s));
            // they are in the resume already: they are not asked as missing, but the person confirms them (see "Your experience mentions")
            foundNames.current = Array.from(new Set([...foundNames.current, ...shown.map((h) => h.skill)]));
          }
        } catch {
          /* if the reading fails, the skills are asked about as before */
        }
        if (!off) setChecking(false);
      }
      await askQuestions(rest, () => off);
    })();
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.key, profileId]);

  // a "yes" puts the thing in the draft (so the preview and the score show it at once); a "no" takes it out again
  const answerQuestion = (i: number, yes: boolean) => {
    const q = (questions ?? [])[i];
    if (!q) return;
    setQuestions((list) => (list ?? []).map((x, j) => (j === i ? { ...x, yes } : x)));
    const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    if (q.where === "skill") {
      const have = draftRef.current.skills ?? [];
      if (yes && !have.some((x) => same(x, q.label))) {
        updateSkills([...have, q.label]);
        placeSkills([q.label]);
      }
      if (!yes) updateSkills(have.filter((x) => !same(x, q.label)));
    } else if (q.where === "certification") {
      const certs = draftRef.current.certifications ?? [];
      if (yes && !certs.some((c) => same(c.name, q.label))) updateCertifications([...certs, { id: `q-${Date.now()}`, name: q.label, issuer: "", year: "" }]);
      if (!yes) updateCertifications(certs.filter((c) => !same(c.name, q.label)));
    }
  };

  const answers = useMemo(() => (questions ?? []).filter((q) => q.yes !== null).map((q) => ({ question: q.text, yes: q.yes === true, note: q.note.trim() })), [questions]);
  const confirmedFacts = answers.filter((a) => a.yes);
  const needsOath = extra.length > 0 || confirmedFacts.length > 0;

  // the number shown in the review is measured by code (the same resume and job always give the same one), not written by the AI
  // the keywords the review asked for are remembered across checks of the same job, so the number only rises as the resume says them
  const [targets, setTargets] = useState<string[]>([]);
  const readiness = useMemo(() => jobScore(draft, job, extra, template, targets), [draft, job, extra, template, targets]);
  const reviewScore = readiness.score;
  const now = readiness.score;

  // the draft as it goes to the server: without the photo (it is big, and the saved one is used)
  const draftPayload = () => {
    const { photo: _photo, ...rest } = draftRef.current; // eslint-disable-line @typescript-eslint/no-unused-vars
    return rest;
  };

  // what this page has already made "Fix all" do for this job: the next review starts from it and does not raise the same things again
  const fixedLog = useRef<{ objective: boolean; jobTitle: boolean; jobIds: string[]; titles: string[] }>({ objective: false, jobTitle: false, jobIds: [], titles: [] });
  const check = (fresh = false) => {
    checkedKey.current = JSON.stringify([draftPayload(), extra, answers, template]);
    const log = fixedLog.current;
    const previous = evaluation || log.titles.length ? { improvements: evaluation?.improvements ?? [], applied: log.titles, fixed: { objective: log.objective, jobTitle: log.jobTitle, jobIds: log.jobIds } } : undefined;
    setEvaluation(null);
    setEvalError(false);
    setEvaluating(true);
    authFetch("/api/applications/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "evaluate", profileId, job, extraSkills: extra, answers, draft: draftPayload(), template, lang: locale, ...(previous ? { previous } : {}), ...(fresh ? { refresh: true } : {}) }) })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const ev = (await r.json()) as Evaluation;
        setEvaluation(ev);
        setTargets((cur) => Array.from(new Set([...cur, ...(ev.targets ?? [])])));
      })
      .catch(() => setEvalError(true))
      .finally(() => setEvaluating(false));
  };

  // ----- the size of the page: measured for this job's resume with the look chosen, and what could go out when it is crowded
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  // the gauge animates when it first appears; coming back to it from another step it is already in place (no replay)
  const gaugeSeen = useRef(false);
  useEffect(() => {
    if (pageInfo) gaugeSeen.current = true;
  }, [pageInfo]);
  const [measuring, setMeasuring] = useState(false);
  const measureKey = JSON.stringify(draftPayload()) + template;
  useEffect(() => {
    let off = false;
    setMeasuring(true);
    const t = setTimeout(() => {
      authFetch("/api/applications/page-fit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId, job, draft: draftPayload(), template, extraSkills: extra, lang: locale }) })
        .then(async (r) => {
          if (!r.ok) throw new Error();
          const d = (await r.json()) as PageInfo;
          if (!off) setPageInfo(d);
        })
        .catch(() => !off && setPageInfo(null))
        .finally(() => !off && setMeasuring(false));
    }, 900);
    return () => {
      off = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureKey]);

  // "Trim it for me": the server takes out, step by step, the least useful for this job until the resume passes the page filter of a
  // recruiter; the page applies it live and it can be undone
  const [trimming, setTrimming] = useState(false);
  const [trimmed, setTrimmed] = useState<{ steps: string[]; passes: boolean } | null>(null);
  const trimUndo = useRef<{ skills: string[]; jobHistory: ProfileData["jobHistory"] } | null>(null);
  const trimLabel = (st: { id: string; n?: number; title?: string }): string =>
    st.id === "olderBullets" ? tr("Shortened the bullets of the older jobs")
    : st.id === "recentBullets" ? tr("Kept four bullets in each recent job")
    : st.id === "skills" ? tr("Took out {n} skills far from this field", { n: st.n ?? 0 })
    : st.id === "reviewSkills" ? tr("Took out {n} skills that repeat another or are the least needed", { n: st.n ?? 0 })
    : st.id === "job" ? tr("Took out the job {title}", { title: st.title ?? "" })
    : tr("Kept three bullets in each recent job");
  const trimIt = async () => {
    if (trimming) return;
    setTrimming(true);
    try {
      const res = await authFetch("/api/applications/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "trim", profileId, job, extraSkills: extra, draft: draftPayload(), template, lang: locale }) });
      if (!res.ok) throw new Error();
      const d = (await res.json()) as { skills: string[]; jobHistory: ProfileData["jobHistory"]; steps: { id: string; n?: number; title?: string }[]; passes: boolean };
      if (d.steps.length === 0) {
        toast.info(tr("There was nothing more to take out."));
        return;
      }
      trimUndo.current = { skills: draftRef.current.skills ?? [], jobHistory: draftRef.current.jobHistory ?? [] };
      updateSkills(d.skills);
      setJobHistory(d.jobHistory);
      setTrimmed({ steps: d.steps.map(trimLabel), passes: d.passes });
    } catch {
      toast.error(tr("We couldn't trim it. Try again in a moment."));
    } finally {
      setTrimming(false);
    }
  };
  const undoTrim = () => {
    if (!trimUndo.current) return;
    updateSkills(trimUndo.current.skills);
    setJobHistory(trimUndo.current.jobHistory);
    trimUndo.current = null;
    setTrimmed(null);
  };

  // looks that suit this job, each measured with this resume: the person decides
  const [looks, setLooks] = useState<{ field: LookField; looks: LookAdvice[] } | null>(null);
  const [looksLoading, setLooksLoading] = useState(false);
  const [looksOpen, setLooksOpen] = useState(false);
  const toggleLooks = () => {
    const next = !looksOpen;
    setLooksOpen(next);
    if (next && !looks) loadLooks();
  };
  const loadLooks = async () => {
    if (looksLoading) return;
    setLooksLoading(true);
    try {
      const res = await authFetch("/api/applications/page-fit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "looks", profileId, job, draft: draftPayload(), template, lang: locale }) });
      if (!res.ok) throw new Error();
      setLooks((await res.json()) as { field: LookField; looks: LookAdvice[] });
    } catch {
      toast.error(tr("We couldn't check the looks. Try again in a moment."));
    } finally {
      setLooksLoading(false);
    }
  };
  const FIELD_NAME: Record<LookField, string> = { tech: "technology", creative: "creative", business: "business", health: "healthcare", academic: "academic", general: "general" };

  const cutSkills = (list: string[]) => updateSkills((draftRef.current.skills ?? []).filter((x) => !list.some((y) => y.toLowerCase() === x.toLowerCase())));
  const cutJobs = (ids: string[]) => setJobHistory((draftRef.current.jobHistory ?? []).filter((j) => !ids.includes(j.id)));

  // ----- "fix all": what the review asked for is written and applied to the draft one change at a time, so the preview changes live
  const [fixing, setFixing] = useState<{ done: number; total: number } | null>(null);
  type AppliedChange = { title: string; was: string[]; now: string[] };
  const [applied, setApplied] = useState<AppliedChange[]>([]);
  const [scoreBefore, setScoreBefore] = useState<number | null>(null); // the number before "Fix all", to show how far it went
  const undoPatch = useRef<ProfilePatch | null>(null);
  const applyPatch = (patch: ProfilePatch) => {
    if ("careerObjective" in patch) updateCareerObjective(patch.careerObjective ?? "");
    if ("jobTitle" in patch) updateJobTitle(patch.jobTitle ?? "");
    if ("skills" in patch) updateSkills(patch.skills ?? []);
    if ("pageGoal" in patch) updatePageGoal(patch.pageGoal ?? "one");
    if ("jobHistory" in patch) setJobHistory(patch.jobHistory ?? []);
  };
  // what changed, exactly: a title and the new text (the objective and the bullets are shown in full, with what they replaced)
  const describeFix = (f: ReviewFix, d: ProfileData): AppliedChange => {
    if (f.type === "objective") return { title: tr("Rewrote the objective for this job"), was: d.careerObjective?.trim() ? [d.careerObjective.trim()] : [], now: [f.text] };
    if (f.type === "jobTitle") return { title: tr("Set the title to “{title}”", { title: f.text }), was: d.jobTitle?.trim() ? [d.jobTitle.trim()] : [], now: [] };
    if (f.type === "bullets") {
      const j = (d.jobHistory ?? []).find((x) => x.id === f.jobId);
      const was = j ? [j.description, ...(j.accomplishments ?? [])].map((x) => (x ?? "").trim()).filter(Boolean) : [];
      return { title: tr("Improved the bullets of {job}", { job: j ? `${j.title}${j.company ? ` · ${j.company}` : ""}` : "" }), was, now: f.bullets };
    }
    if (f.type === "addSkills") return { title: tr("Added skills: {skills}", { skills: f.skills.join(", ") }), was: [], now: [] };
    if (f.type === "removeSkills") return { title: tr("Removed repeated skills: {skills}", { skills: f.skills.join(", ") }), was: [], now: [] };
    return { title: "", was: [], now: [] };
  };
  const fixAll = async () => {
    if (!evaluation || fixing) return;
    setFixing({ done: 0, total: 0 });
    setApplied([]);
    setScoreBefore(reviewScore);
    try {
      const res = await authFetch("/api/applications/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fix", profileId, job, extraSkills: extra, answers, targets, improvements: evaluation.improvements, draft: draftPayload(), template, lang: locale }) });
      if (!res.ok) throw new Error();
      const { fixes } = (await res.json()) as { fixes: ReviewFix[] };
      const start = draftRef.current;
      const whole = applyFixes(start, fixes);
      if (fixes.length === 0 || !patchChangesProfile(start, whole)) {
        toast.info(tr("There was nothing more to change with the facts you have."));
        return;
      }
      undoPatch.current = snapshotFor(start, whole);
      fixedBefore.current = { ...fixedLog.current, jobIds: [...fixedLog.current.jobIds], titles: [...fixedLog.current.titles] };
      let cur: ProfileData = start;
      const done: AppliedChange[] = [];
      setFixing({ done: 0, total: fixes.length });
      for (let i = 0; i < fixes.length; i++) {
        const patch = applyFixes(cur, [fixes[i]]);
        if (patchChangesProfile(cur, patch)) {
          const change = describeFix(fixes[i], cur);
          done.push(change);
          const f = fixes[i];
          const log = fixedLog.current;
          log.titles.push(change.title);
          if (f.type === "objective") log.objective = true;
          if (f.type === "jobTitle") log.jobTitle = true;
          if (f.type === "bullets" && !log.jobIds.includes(f.jobId)) log.jobIds.push(f.jobId);
          applyPatch(patch);
          cur = { ...cur, ...patch };
          setApplied([...done]);
        }
        setFixing({ done: i + 1, total: fixes.length });
        await sleep(700); // one change at a time, so the person sees the preview change
      }
      checkedOnce.current = true;
      setTimeout(check, 150);
    } catch {
      toast.error(tr("We couldn't write the fixes. Try again in a moment."));
    } finally {
      setFixing(null);
    }
  };
  const fixedBefore = useRef<typeof fixedLog.current>({ objective: false, jobTitle: false, jobIds: [], titles: [] });
  const undoFix = () => {
    if (!undoPatch.current) return;
    applyPatch(undoPatch.current);
    undoPatch.current = null;
    fixedLog.current = fixedBefore.current; // undone: those changes are no longer "done", so they may be raised again
    setApplied([]);
  };

  // The review always reads the resume as it is at that moment (what was confirmed in "Your fit" and edited in "Edit for this job"): entering
  // this step checks it again when anything changed since the last check. Nothing is rewritten until the person presses "Fix all", and
  // after it the new draft is checked again.
  const checkedOnce = useRef(false);
  const checkedKey = useRef("");
  const stateKey = () => JSON.stringify([draftPayload(), extra, answers, template]);
  const goReview = () => {
    setStep("review");
    if (!checkedOnce.current || checkedKey.current !== stateKey()) {
      checkedOnce.current = true;
      // the changes listed belong to the previous review; a new reading of a draft the person edited starts clean
      if (!fixing) {
        setApplied([]);
        undoPatch.current = null;
      }
      check();
    }
  };

  // The words of the review are about the length and the look in force when it was written ("too crowded for one page"). When the person
  // changes either one while reading it, the review is written again, so what it says is always about what is on screen.
  const lookKey = `${draft.pageGoal ?? "one"}|${template}`;
  const lastLookKey = useRef(lookKey);
  useEffect(() => {
    if (lastLookKey.current === lookKey) return;
    lastLookKey.current = lookKey;
    if (step !== "review" || !checkedOnce.current || evaluating || fixing) return;
    const t = setTimeout(() => check(), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey]);

  const create = async () => {
    setError("");
    setCreating(0);
    const tick = setInterval(() => setCreating((s) => (s === null ? s : Math.min(s + 1, CREATING.length - 1))), 3500);
    try {
      const res = await authFetch("/api/applications/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, template, job, skillMode, extraSkills: extra, answers, focus: evaluation?.improvements ?? [], truthful: needsOath && truthful, draft: draftPayload(), level: asLevel(draft.experienceLevel), mentionLevel, lang: locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ? tr(data.error) : tr("We couldn't prepare that application."));
      try {
        sessionStorage.removeItem(APPLY_JOB_KEY);
      } catch {
        /* storage unavailable */
      }
      router.push(`/home/job-ads?apply=${encodeURIComponent(job.key)}`);
    } catch (err) {
      setError((err as Error).message);
      setCreating(null);
      toast.error(tr("We couldn't prepare that application."));
    } finally {
      clearInterval(tick);
    }
  };

  // (the preview is drawn in the language the final resume will be written in: the job's)
  const preview = useMemo(() => previewFromProfile(draft, jobLanguage), [draft, jobLanguage]);
  // the color handlers are read through refs so the element below keeps the same identity: React then skips the whole sheet on the
  // renders that scrolling causes
  const accentRef = useRef(updateAccentColor);
  accentRef.current = updateAccentColor;
  const fillRef = useRef(updateFillPage);
  fillRef.current = updateFillPage;
  const previewNode = useMemo(
    () => (
      <LivePreview
        d={preview}
        template={template}
        active={null}
        inline
        large
        overlay={customizing ? <AccentPicker template={template} value={draft.accentColor} onChange={(id) => accentRef.current(id)} fill={draft.fillPage} onFill={(on) => fillRef.current(on)} /> : undefined}
      />
    ),
    [preview, template, customizing, draft.accentColor, draft.fillPage]
  );

  if (creating !== null) {
    return (
      <div className="mx-auto max-w-md py-24">
        <ul className="space-y-4">
          {CREATING.map((s, i) => (
            <li key={s} className={`flex items-center gap-3 text-sm transition-opacity ${i > creating ? "opacity-40" : ""}`}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                {i < creating ? <Check className="h-5 w-5 text-green-500" strokeWidth={3} /> : i === creating ? <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
              </span>
              <span className={i === creating ? "font-semibold" : ""}>{tr(s)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-xs text-muted-foreground">{tr("This takes about half a minute.")}</p>
      </div>
    );
  }

  // how the resume sits on the page, judged as a recruiter would (see lib/pageRules): one page, text that is easy to read
  const textSize = pageInfo ? Math.round((pageInfo.scale ?? 1) * 100) : 100;
  const minPct = Math.round(PAGE_MIN_SCALE * 100);
  const tone: "idle" | "ok" | "tight" | "full" = !pageInfo ? "idle" : pageInfo.crowded ? "full" : textSize < 90 ? "tight" : "ok";
  const toneColor = { idle: "#94a3b8", ok: "#22c55e", tight: "#f59e0b", full: "#ef4444" }[tone];
  const pageCount = pageInfo?.pages ?? 1;
  const acceptsPages = pageInfo?.maxPages ?? 1;
  // the bar goes from 60% to 100% of the normal text size; the marker sits where this resume is (more than one page: at the far left)
  const markerAt = !pageInfo ? 100 : pageCount > 1 && acceptsPages === 1 ? 0 : Math.max(0, Math.min(100, ((textSize - 60) / 40) * 100));
  const looksTab = (
    <button
      type="button"
      aria-expanded={looksOpen}
      onClick={toggleLooks}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${looksOpen ? "border-blue-600 bg-blue-600 text-white" : "bg-card text-muted-foreground hover:text-foreground"}`}
    >
      <LayoutTemplate className="h-4 w-4" />
      {tr("Looks that suit this job")}
      <ChevronDown className={`h-4 w-4 transition-transform ${looksOpen ? "rotate-180" : ""}`} />
    </button>
  );
  const pageSize = (
    <section className="space-y-4 border-y py-4" aria-label={tr("Size of the page")}>
      <div>
        <p className="mb-2 text-sm font-bold">{tr("How long should it be?")}</p>
        <PageLengthPicker compact value={asPageGoal(draft.pageGoal)} template={template} onChange={(g) => updatePageGoal(g)} />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="flex min-w-0 flex-1 basis-72 items-center gap-4">
        {/* the sheet: it fills up as the resume takes more of the page */}
        <svg width="34" height="44" viewBox="0 0 34 44" aria-hidden className="shrink-0">
          <defs>
            <clipPath id="page-fill">
              <rect x="2" y="2" width="30" height="40" rx="3" />
            </clipPath>
          </defs>
          <rect x="2" y="2" width="30" height="40" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
          <g clipPath="url(#page-fill)">
            <rect x="2" y={42 - 40 * (tone === "idle" ? 0.15 : tone === "ok" ? (textSize >= 100 ? 0.7 : 0.82) : 1)} width="30" height={40} fill={toneColor} fillOpacity="0.22" style={{ transition: "all 400ms ease" }} />
          </g>
          {[12, 18, 24, 30].map((y) => (
            <line key={y} x1="8" x2={y === 30 ? 20 : 26} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" />
          ))}
        </svg>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-bold">{tr("Page")}</p>
            <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: toneColor }}>
              {measuring && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {tone === "idle" ? (measuring ? tr("Measuring the page…") : tr("We couldn't measure the page.")) : tone === "ok" ? (pageCount > 1 ? tr("It fits on {pages} pages.", { pages: pageCount }) : tr("It fits on one page.")) : tone === "tight" ? tr("Tight, but it fits") : pageCount > 1 ? tr("This resume takes {pages} pages.", { pages: pageCount }) : tr("It is crowded")}
            </p>
          </div>
          {pageInfo ? (
            <motion.div
              key="gauge"
              className="relative mt-2.5 h-2 rounded-full"
              style={{ background: "linear-gradient(to right, #ef4444 0%, #ef4444 60%, #f59e0b 65%, #f59e0b 72%, #22c55e 78%, #22c55e 100%)", transformOrigin: "left" }}
              initial={gaugeSeen.current ? false : { opacity: 0, scaleX: 0.55 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              aria-hidden
            >
              <motion.span
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-foreground shadow"
                initial={gaugeSeen.current ? false : { left: "0%", opacity: 0, scale: 0.4 }}
                animate={{ left: `${markerAt}%`, opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 140, damping: 18, delay: 0.25 }}
              />
            </motion.div>
          ) : (
            <div className="shimmer mt-2.5 h-2 rounded-full bg-muted" aria-hidden />
          )}
          {pageInfo && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {pageCount > 1 ? (acceptsPages > 1 ? tr("It is as long as you chose.") : tr("A recruiter reads one page.")) : textSize >= 100 ? tr("The text keeps its normal size.") : tr("The text is at {pct}% of its normal size.", { pct: textSize })}{" "}
              {tone === "full" || tone === "tight" ? tr("Below {min}% it is small print and gets skipped.", { min: minPct }) : ""}
            </p>
          )}
        </div>
      </div>
      {looksTab}
      </div>

      {/* the looks that suit this job and this resume (the tab is at the right of "Page"); the person decides */}
      <div>
        {looksOpen && (
          <div className="mt-1">
            {looks && (
              <div className="mb-2 flex justify-end">
                <button type="button" onClick={loadLooks} disabled={looksLoading} className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:underline">
                  {looksLoading ? tr("Measuring the page…") : tr("Check again")}
                </button>
              </div>
            )}
            {looksLoading && !looks && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Measuring your resume in each look…")}
              </p>
            )}
            {looks && (
              <>
                <p className="mb-4 text-xs text-muted-foreground">{tr("For {field} roles, measured with your resume. Tap one to see it.", { field: tr(FIELD_NAME[looks.field]) })}</p>
                <ul className="flex flex-wrap gap-x-5 gap-y-5">
                  {looks.looks.map((l) => (
                    <li key={l.id} className="w-[6.75rem]">
                      <button type="button" onClick={() => changeTemplate(l.id)} aria-pressed={l.id === template} className="group flex w-full flex-col items-center gap-1.5 text-center">
                        <span className={`block w-full overflow-hidden rounded-md transition-all ${l.id === template ? "shadow-md ring-2 ring-blue-600 ring-offset-2 ring-offset-background" : "shadow-sm ring-1 ring-black/10 group-hover:-translate-y-0.5 group-hover:shadow-md"}`}>
                          {/* the real design of that look, drawn small with this resume: the same engine as the live preview */}
                          <span className="pointer-events-none block" aria-hidden>
                            <LivePreview d={preview} template={l.id} active={null} inline bare />
                          </span>
                        </span>
                        <span className="text-xs font-bold leading-tight">{tr(l.name)}</span>
                        <span className="text-[11px] leading-tight" style={{ color: l.passes ? (l.scale < 0.9 ? "#d97706" : "#16a34a") : "#dc2626" }}>
                          {l.pages > 1 ? tr("Does not fit on one page") : l.passes ? tr("Fits at {pct}%", { pct: Math.round(l.scale * 100) }) : tr("Too small: {pct}%", { pct: Math.round(l.scale * 100) })}
                        </span>
                        {l.id === template ? <span className="text-[11px] font-semibold text-blue-600">{tr("In use")}</span> : l.safe ? <span className="text-[11px] text-muted-foreground">{tr("Safe for ATS")}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {pageInfo?.crowded && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-sm text-sm font-semibold">{acceptsPages > 1 ? tr("It has to fit on two pages at a readable size.") : tr("It has to fit on one page at a readable size.")}</p>
            <div className="flex flex-wrap items-center gap-2">
              {/* the person decides: keep everything on a second page, or cut what is least useful for this job */}
              {canRunTwoPages(template) && asPageGoal(draft.pageGoal) === "one" && (
                <Button size="sm" variant="outline" onClick={() => updatePageGoal("two")} className="gap-1.5">
                  {tr("Keep it all: use two pages")}
                </Button>
              )}
              <Button size="sm" onClick={trimIt} disabled={trimming} className="gap-1.5">
                {trimming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                {tr("Trim it for me")}
              </Button>
            </div>
          </div>
          {!canRunTwoPages(template) && asPageGoal(draft.pageGoal) !== "one" ? null : !canRunTwoPages(template) && (
            <p className="text-xs text-muted-foreground">{tr("To keep everything, pick a one-column look such as Classic, ATS, Executive or Minimal: they can use two pages.")}</p>
          )}
          {pageInfo.cut.skills.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">{tr("Skills far from this field")}</p>
              <div className="flex flex-wrap gap-1.5">
                {pageInfo.cut.skills.map((sk) => (
                  <button key={sk} type="button" onClick={() => cutSkills([sk])} title={tr("Remove from this resume")} className="group inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-red-500 hover:bg-red-500/5 hover:text-red-500">
                    {sk}
                    <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {pageInfo.cut.jobs.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">{tr("Older jobs")}</p>
              <ul className="space-y-1">
                {pageInfo.cut.jobs.map((j) => (
                  <li key={j.id} className="group flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/50">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
                      {(j.company || j.title).trim().charAt(0).toUpperCase() || "·"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold leading-tight">{j.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[j.company, j.start ? `${j.start}${j.end ? ` – ${j.end}` : ` – ${tr("Present")}`}` : ""].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => cutJobs([j.id])}
                      title={tr("Remove from this resume")}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-red-500 hover:bg-red-500/5 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {tr("Remove")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{tr("Only for this resume. Your saved profile stays the same. If you do nothing, Kaizo trims the oldest details when it creates the resume, so it always fits.")}</p>
        </div>
      )}

      {pageInfo && pageInfo.cut.review.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3 px-4 py-3.5">
            <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
              <TriangleAlert className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-bold">{tr("Worth a second look")}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {tr("Your list has {n} skills and the page is {state}. These are the least necessary or the ones that repeat another. Remove the ones you do not need; it depends on your case.", { n: (draft.skills ?? []).length, state: pageInfo.crowded ? tr("crowded") : tr("tight") })}
              </p>
            </div>
          </div>
          <ul className="grid gap-px border-t border-amber-500/20 bg-amber-500/20 sm:grid-cols-2">
            {pageInfo.cut.review.map((r) => (
              <li key={r.skill} className="bg-card">
                <button
                  type="button"
                  onClick={() => cutSkills([r.skill])}
                  title={tr("Remove from this resume")}
                  className="group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-red-500/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{r.skill}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.why === "repeats" ? tr("repeats {skill}", { skill: r.of ?? "" }) : r.why === "generic" ? tr("generic") : tr("not asked")}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors group-hover:border-red-500 group-hover:text-red-500">
                    <X className="h-3.5 w-3.5" />
                    {tr("Remove")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {trimmed && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <p className="text-sm font-bold">{trimmed.passes ? tr("Trimmed, and now it fits") : tr("Trimmed as far as it goes")}</p>
            <button type="button" onClick={undoTrim} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <Undo2 className="h-3.5 w-3.5" />
              {tr("Undo")}
            </button>
          </div>
          <ul className="space-y-1">
            {trimmed.steps.map((t) => (
              <li key={t} className="flex gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" strokeWidth={3} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );

  const STEPS = [
    { id: "fit" as const, label: "Your fit" },
    { id: "edit" as const, label: "Edit for this job" },
    { id: "review" as const, label: "Review and create" },
  ];

  const scoreBlock = (
    <div className="flex shrink-0 flex-col items-center" title={tr("Your fit for this job")} role="status" aria-label={`${tr("Your fit for this job")}: ${now}`}>
      <Ring value={now} size={88} />
      <p className="mt-1 text-xs font-semibold">
        {tr("Your fit")}
        {now > before && <span className="ml-1.5 font-bold text-green-600">+{now - before}</span>}
      </p>
    </div>
  );
  const stepTabs = (
    <div role="tablist" className="inline-flex rounded-full border bg-card p-1 shadow-sm">
      {STEPS.map((s, i) => (
        <button
          key={s.id}
          role="tab"
          aria-selected={step === s.id && !customizing}
          onClick={() => {
            setCustomizing(false);
            if (s.id === "review") goReview();
            else setStep(s.id);
          }}
          className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-all ${step === s.id && !customizing ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" : "text-muted-foreground hover:text-foreground"}`}
        >
          {i + 1}. {tr(s.label)}
        </button>
      ))}
    </div>
  );
  const customizeButton = (
    <button
      type="button"
      aria-pressed={customizing}
      onClick={() => setCustomizing((v) => !v)}
      className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold shadow-sm transition-colors ${customizing ? "border-blue-600 bg-blue-600 text-white" : "bg-card text-muted-foreground hover:text-foreground"}`}
    >
      <Palette className="h-4 w-4" />
      {tr("Customize")}
    </button>
  );

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* two columns from the top: the live preview is pinned over the right one, so nothing else may sit there */}
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="min-w-0 space-y-7">
          {/* the banner: the job, the score and the steps. It stays at the top while the page scrolls and shrinks in place. The content is only
              scaled and the background is its own layer, so its width and the space it takes in the page never change: nothing jumps. The
              score does not shrink. */}
          <div className="pointer-events-none sticky top-16 z-30 -ml-4 sm:-ml-5 lg:-ml-6">
            <div className="relative pl-4 pt-2 sm:pl-5 lg:pl-6">
              <div
                aria-hidden
                className={`absolute inset-x-0 top-0 bg-background transition-[height,box-shadow] duration-300 ease-out ${compact ? "border-b shadow-sm" : ""}`}
                style={{ height: compact && bannerH ? Math.max(Math.round(bannerH * BANNER_SHRINK) + 20, 124) : "100%" }}
              />
              <div className={`relative h-8 transition-opacity duration-200 ${compact ? "pointer-events-none opacity-0" : "pointer-events-auto"}`}>
                <button type="button" onClick={() => router.push("/home/job-ads")} tabIndex={compact ? -1 : 0} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                  {tr("Back to the jobs")}
                </button>
              </div>

              <div
                ref={bannerContent}
                className="pointer-events-auto relative origin-top-left pb-3 transition-transform duration-300 ease-out will-change-transform"
                style={{ width: "calc(100% - 7.5rem)", transform: compact ? `translateY(-32px) scale(${BANNER_SHRINK})` : "none" }}
              >
                <div className="mb-3 flex items-center gap-4">
                  <CompanyLogo company={job.company} logo={job.logo} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-500">{tr("Resume for")}</p>
                    <h1 className="truncate text-2xl font-extrabold leading-tight">{tr(job.title)}</h1>
                    <p className="truncate text-sm text-muted-foreground">{job.company}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
                  {stepTabs}
                  {customizeButton}
                </div>
              </div>

              {/* the score keeps its size when the banner shrinks; it only goes up with it */}
              <div className="pointer-events-auto absolute right-0 top-2 transition-transform duration-300 ease-out" style={{ transform: compact ? "translateY(-4px)" : "none" }}>
                {scoreBlock}
              </div>
            </div>
          </div>

          {customizing && (
            <>
              <div>
                <h2 className="text-3xl font-extrabold leading-tight sm:text-4xl">{tr("Choose another look")}</h2>
                <p className="mt-2 text-muted-foreground">{tr("Your content stays exactly as it is. Pick one and watch the preview change.")}</p>
              </div>
              {/* choosing a look applies it right away */}
              <TemplateSelector onTemplateSelect={changeTemplate} showcase />
            </>
          )}

          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">{error}</p>}

          {!customizing && step === "fit" && (
            <>
              {/* the job is in another language than the resume: the person can translate it, for this resume only */}
              {translation ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm">
                  <Languages className="h-4 w-4 shrink-0 text-green-600" />
                  <span className="min-w-0 flex-1">{tr("Translated to {language} for this job. Your saved profile does not change.", { language: languageName(jobLanguage) })}</span>
                  <button type="button" onClick={undoTranslation} className="font-semibold text-blue-500 underline-offset-4 hover:underline">{tr("Use my original")}</button>
                </div>
              ) : (
                draftLanguage && draftLanguage !== jobLanguage && (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm">
                    <Languages className="h-4 w-4 shrink-0 text-blue-500" />
                    <span className="min-w-0 flex-1">
                      {placeName
                        ? tr("This job is in {place}, where they speak {language}. Your resume is in {mine}. Do you want to translate it to {language} just for this job?", { place: placeName, language: languageName(jobLanguage), mine: languageName(draftLanguage) })
                        : tr("This job is written in {language} and your resume is in {mine}. Do you want to translate it to {language} just for this job?", { language: languageName(jobLanguage), mine: languageName(draftLanguage) })}
                    </span>
                    <button type="button" onClick={() => void translateToJob()} disabled={translating} className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
                      {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                      {translating ? tr("Translating…") : tr("Translate to {language}", { language: languageName(jobLanguage) })}
                    </button>
                  </div>
                )
              )}

              {level.years > years + 1 && (
                <p className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  {tr("This job asks for about {years} years of experience and your profile shows {mine}. That is why the fit is much lower.", { years: level.years, mine: years > 0 ? tr("{n} year{v1}", { n: years, v1: years === 1 ? "" : "s" }) : tr("none") })}
                </p>
              )}

              <ExperienceLevelPicker mention={mentionLevel} onMention={setMention} />
              {mentionLevel && !withLevelReady && (
                <p className="-mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {tr("Writing your level into the objective…")}
                </p>
              )}

              {foundList.length > 0 && !checking && (
                <section>
                  <h3 className="text-sm font-bold">{tr("Your experience mentions these skills")}</h3>
                  <p className="mb-3 text-sm text-muted-foreground">{tr("They are not in your list of skills. Do you want them on this resume?")}</p>
                  <ul className="divide-y rounded-xl border">
                    {foundList.map((f) => (
                      <li key={f.skill} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <span className="min-w-0">
                          <span className="font-medium">{f.skill}</span>
                          {f.quote && <span className="mt-0.5 block truncate text-xs text-muted-foreground">“{f.quote}”</span>}
                        </span>
                        <YesNo label={f.skill} value={foundAnswer[f.skill.toLowerCase()] ?? null} onChange={(v) => answerFound(f.skill, v)} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {haveChips.length + aiChips.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-bold">{tr("You already have")}{" "}{haveChips.length + aiChips.length}{" "}{tr("of the skills it mentions")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {haveChips.map((x) => (
                      <span key={x} className="rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-500">{x}</span>
                    ))}
                    {aiChips.map((h) => (
                      <span key={h.skill} title={`“${h.quote}”`} className="rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-500">{h.skill}</span>
                    ))}
                  </div>
                  {aiChips.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{tr("Found in your resume, so we did not ask. Hover a skill to see where.")}</p>}
                </div>
              )}

              {checking && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tr("Reading your resume to see what you already have…")}
                </p>
              )}

              {!checking && unrelated.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold">{tr("Do you have these skills?")} <span className="ml-2 rounded bg-muted px-1.5 py-0.5 align-middle text-[11px] font-medium normal-case tracking-normal text-muted-foreground">{tr("Written with AI")}</span></h3>
                  <p className="mb-3 text-sm text-muted-foreground">{tr("The job asks for them and your profile does not show them. Say yes only if you really know them: they go on this resume and nowhere else.")}</p>
                  <ul className="divide-y rounded-xl border">
                    {unrelated.slice(0, 12).map((sk) => (
                      <li key={sk} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <span className="font-medium">{sk}</span>
                        <YesNo label={sk} value={skillAnswer[sk] ?? null} onChange={(v) => answerSkill(sk, v)} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!checking && related.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold">{tr("Do you also use these?")}</h3>
                  <p className="mb-2 text-sm text-muted-foreground">{tr("You already have the general skill. Tap the specific ones you have really used.")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {related.slice(0, 12).map((sk) => {
                      const on = skillAnswer[sk] === true;
                      return (
                        <button
                          key={sk}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => answerSkill(sk, !on)}
                          title={tr("You have {base}", { base: baseOf(sk) ?? "" })}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${on ? "border-blue-600 bg-blue-600 text-white" : "text-muted-foreground hover:border-blue-500 hover:text-foreground"}`}
                        >
                          {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          {sk}
                          <span className={`text-xs ${on ? "text-white/80" : "text-muted-foreground"}`}>· {tr("you have {base}", { base: baseOf(sk) ?? "" })}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {questionsFailed && (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
                  <span>{tr("We couldn't read the job to prepare your questions.")}</span>
                  <button type="button" onClick={() => askQuestions(restForQuestions.current)} className="font-semibold text-blue-500 underline-offset-4 hover:underline">{tr("Try again")}</button>
                </p>
              )}
              {questions === null ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tr("Reading the job to see what to ask you…")}
                </p>
              ) : (
                questions.length > 0 && (
                  <section>
                    <h3 className="text-sm font-bold">{tr("The job also asks for")} <span className="ml-2 rounded bg-muted px-1.5 py-0.5 align-middle text-[11px] font-medium normal-case tracking-normal text-muted-foreground">{tr("Written with AI")}</span></h3>
                    <p className="mb-3 text-sm text-muted-foreground">{tr("It asks for these clearly and your resume does not show them. Answer only what is true.")}</p>
                    <ul className="divide-y rounded-xl border">
                      {questions.map((q, i) => (
                        <li key={q.text} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-sm">{q.text}</span>
                            <YesNo label={q.text} value={q.yes} onChange={(v) => answerQuestion(i, v)} />
                          </div>
                          {q.yes === true && (
                            <p className="mt-1.5 text-xs text-green-600">
                              {q.where === "skill" ? tr("Added to the skills of this resume.") : q.where === "certification" ? tr("Added to the certifications of this resume.") : tr("It will be used in your objective and your cover letter.")}
                            </p>
                          )}
                          {q.yes === true && q.where === "highlight" && (
                            <input
                              value={q.note}
                              onChange={(e) => setQuestions((list) => (list ?? []).map((x, j) => (j === i ? { ...x, note: e.target.value.slice(0, 300) } : x)))}
                              placeholder={tr("Add a detail if you want: where, how long, how much…")}
                              aria-label={tr("Detail")}
                              className="mt-2 h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              )}

              {/* nothing to ask: say so, instead of leaving the step looking empty */}
              {!checking && !questionsFailed && questions !== null && questions.length === 0 && unrelated.length === 0 && related.length === 0 && foundList.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green-500/10 text-green-600">
                    <Check className="h-6 w-6" strokeWidth={3} />
                  </span>
                  <h3 className="text-base font-extrabold">{tr("Nothing to ask you for this job")}</h3>
                  <p className="max-w-md text-sm text-muted-foreground">{tr("Your profile already shows what the job asks for, so there are no questions. Go on to edit your resume for this job.")}</p>
                  <button type="button" onClick={() => setStep("edit")} className="mt-1 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                    {tr("Edit for this job")}
                  </button>
                </div>
              )}
            </>
          )}

          {!customizing && step === "edit" && (
            <>
              <p className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">{tr("These edits are only for this resume. Your saved profile stays the same.")}</p>
              {pageSize}
              <div role="tablist" className="flex flex-wrap gap-1.5">
                {SECTIONS.map((s) => (
                  <button key={s} role="tab" aria-selected={section === s} onClick={() => setSection(s)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${section === s ? "border-blue-600 bg-blue-600 text-white" : "text-muted-foreground hover:border-blue-500 hover:text-foreground"}`}>
                    {tr(SECTION_LABEL[s])}
                  </button>
                ))}
              </div>
              <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                {section === "contact" && <ContactInfoSection />}
                {section === "objective" && <CareerObjectiveSection />}
                {section === "skills" && (
                  <>
                    <SkillsSection />
                    <SkillLevelPicker skills={draft.skills ?? []} levels={draft.skillLevels ?? {}} onChange={updateSkillLevels} />
                    <SkillGroupsEditor skills={draft.skills ?? []} groups={draft.skillGroups} onChange={updateSkillGroups} />
                  </>
                )}
                {section === "jobs" && <JobHistorySection />}
                {section === "education" && <EducationSection />}
                {section === "projects" && <ExtrasEditor only={["projects"]} />}
                {section === "internships" && <ExtrasEditor only={["internships"]} />}
                {section === "links" && <ExtrasEditor only={["links", "certifications", "interests"]} />}
                {section === "languages" && <ExtrasEditor only={["languages"]} languages={draft.languages ?? []} onLanguagesChange={updateLanguages} />}
              </div>
            </>
          )}

          {!customizing && step === "review" && (
            <>
              <div>
                <h2 className="text-lg font-extrabold">{tr("Check it before we write it")}</h2>
                <p className="text-sm text-muted-foreground">{tr("This is what the resume starts from. The preview is your profile with what you confirmed; the final resume is then tailored to the job.")}</p>
                <p className="mt-1 text-xs font-semibold text-foreground">
                  {resumeLangForJob(job, locale) === "es"
                    ? tr("The resume and the letter for this job will be written in Spanish, the language of the job. Your saved profile does not change.")
                    : tr("The resume and the letter for this job will be written in English, the language of the job. Your saved profile does not change.")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{tr("The questions, the check and the final resume and letter are written with AI. It can make mistakes: read everything before you send it.")}</p>
              </div>

              {pageSize}

              <section className="rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <Sparkles className="h-4 w-4 text-blue-500" />
                    {tr("How it reads for this job")}
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => check(true)} disabled={evaluating || !!fixing}>{tr("Check again")}</Button>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      <Ring value={reviewScore} size={72} loading={evaluating || !!fixing || (!evaluation && !evalError)} />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tr("Your fit")}</span>
                      {scoreBefore !== null && scoreBefore !== reviewScore && !evaluating && !fixing && applied.length > 0 && (
                        <span className={`text-[11px] font-bold tabular-nums ${reviewScore > scoreBefore ? "text-green-500" : "text-muted-foreground"}`}>
                          {scoreBefore} → {reviewScore}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed">
                      {evaluating ? tr("Checking the requirements, the ATS and your achievements…") : evaluation?.headline || (evalError ? tr("We couldn't check the draft this time. You can still create the resume.") : "")}
                    </p>
                  </div>
                  {evaluating ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {tr("Checking the requirements, the ATS and your achievements…")}
                    </p>
                  ) : (
                    evaluation && (
                      <>
                        {evaluation.strengths.length > 0 && (
                          <ul className="space-y-1.5">
                            {evaluation.strengths.map((s) => (
                              <li key={s} className="flex gap-2 text-sm">
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" strokeWidth={3} />
                                {s}
                              </li>
                            ))}
                          </ul>
                        )}
                        {evaluation.improvements.length > 0 && (
                          <div>
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                              <p className="text-sm font-bold">{tr("The resume will work on")}</p>
                              <Button size="sm" onClick={fixAll} disabled={!!fixing} className="gap-1.5">
                                {fixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                {fixing ? (fixing.total ? tr("Applying {done} of {total}…", { done: fixing.done, total: fixing.total }) : tr("Writing the fixes…")) : tr("Fix all")}
                              </Button>
                            </div>
                            <ul className="space-y-1.5">
                              {evaluation.improvements.map((s) => (
                                <li key={s} className="flex gap-2 text-sm">
                                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )
                  )}
                  {applied.length > 0 && (
                    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <p className="text-sm font-bold">{tr("Changes made to this resume")}</p>
                        {!fixing && (
                          <button type="button" onClick={undoFix} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                            <Undo2 className="h-3.5 w-3.5" />
                            {tr("Undo")}
                          </button>
                        )}
                      </div>
                      <ul className="space-y-1">
                        {applied.map((a) => (
                          <li key={a.title} className="text-sm">
                            <span className="flex gap-2">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" strokeWidth={3} />
                              {a.title}
                            </span>
                            {a.now.length > 0 && (
                              <ul className="ml-6 mt-1 space-y-1 border-l-2 border-green-500/40 pl-3 text-muted-foreground">
                                {a.now.map((t) => (
                                  <li key={t} className="text-foreground">{t}</li>
                                ))}
                              </ul>
                            )}
                            {a.now.length > 0 && a.was.length > 0 && (
                              <details className="ml-6 mt-1 text-xs text-muted-foreground">
                                <summary className="cursor-pointer font-semibold">{tr("Before")}</summary>
                                <ul className="mt-1 space-y-1 border-l-2 border-muted pl-3">
                                  {a.was.map((t) => (
                                    <li key={t}>{t}</li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>

              {confirmedFacts.length > 0 && (
                <section>
                  <p className="mb-1.5 text-sm font-bold">{tr("You confirmed")}</p>
                  <ul className="space-y-1 text-sm">
                    {confirmedFacts.map((a) => (
                      <li key={a.question}>{a.question}{a.note ? ` — ${a.note}` : ""}</li>
                    ))}
                  </ul>
                </section>
              )}

              <fieldset>
                <legend className="mb-2 text-sm font-bold">{tr("Skills on this resume")}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    { id: "relevant", title: "Only the ones that fit this job", text: "Smart filter: keeps the skills the posting names or needs, plus closely related ones, most useful first." },
                    { id: "all", title: "All my skills", text: "Keeps every skill in your profile, with the ones this job asks for first." },
                  ] as const).map((o) => (
                    <label key={o.id} className={`cursor-pointer rounded-xl border p-3.5 transition-colors ${skillMode === o.id ? "border-blue-600 bg-blue-600/5" : "hover:border-blue-500/50"}`}>
                      <input type="radio" name="skill-mode" value={o.id} checked={skillMode === o.id} onChange={() => setSkillMode(o.id)} className="sr-only" />
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${skillMode === o.id ? "border-blue-600 bg-blue-600" : ""}`}>{skillMode === o.id && <Check className="h-3 w-3 text-white" strokeWidth={4} />}</span>
                        {tr(o.title)}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{tr(o.text)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {needsOath && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-blue-600/30 bg-blue-600/5 p-4 text-sm">
                  <input type="checkbox" checked={truthful} onChange={(e) => setTruthful(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded" />
                  <span>
                    <span className="block font-semibold">{tr("I declare that everything I confirmed is true.")}</span>
                    <span className="mt-0.5 block text-muted-foreground">{tr("Kaizo writes the resume and the letter with AI, from what you confirmed, and does not check it. You are responsible for what you send to an employer, including any false or exaggerated claim.")}</span>
                  </span>
                </label>
              )}

              <div className="flex justify-end border-t pt-5">
                <Button onClick={create} disabled={evaluating || !!fixing || (needsOath && !truthful)} className="gap-2">{tr("Create my resume for this job")}</Button>
              </div>
            </>
          )}
        </div>

        {/* the live preview, next to you as in the resume builder; a line divides it from everything else. It stays in place while the page
            scrolls on the left, and if you scroll with the cursor over it, it is the sheet that scrolls (to see what is below) */}
        <div className="min-w-0 lg:-ml-4 lg:border-l lg:pl-4">
          <div className="no-scrollbar [contain:layout_paint] lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overscroll-contain">
            {previewNode}
          </div>
        </div>
      </div>
    </div>
  );
}

