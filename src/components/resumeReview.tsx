"use client";

import { readNdjson } from "@/lib/ndjson";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Loader2, Pencil, RotateCcw, Sparkles, Undo2, Wand2, X } from "lucide-react";
import { useProfile } from "@/context/profileContext";
import { useToast } from "@/context/toastContext";
import { authFetch } from "@/lib/authFetch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  applyFixes,
  reviewForTemplate,
  scoreLabel,
  snapshotFor,
  patchChangesProfile,
  lengthQuestion,
  withLengthAnswer,
  type ProfilePatch,
  type ReviewFix,
  type ReviewIssue,
  type ReviewResult,
} from "@/lib/resumeReview";
import { useT } from "@/i18n/provider";

const LOADING_MESSAGES = [
  "Reading your resume…",
  "Checking your summary and skills…",
  "Looking at your bullet points…",
  "Seeing what recruiters scan first…",
  "Scoring it and writing your tips…",
];

const IMPACT_STRIPE: Record<ReviewIssue["impact"], string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-neutral-400 dark:bg-neutral-600",
};
const IMPACT_TEXT: Record<ReviewIssue["impact"], string> = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-muted-foreground",
};
const IMPACT_LABEL: Record<ReviewIssue["impact"], string> = { high: "Big impact", medium: "Worth doing", low: "Nice to have" };

/** Counts up to `value` so the score feels earned. */
function useCountUp(value: number, ms = 1100) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setN(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // a hidden tab pauses animation frames: the final number is set anyway, so it never stays stuck half way
    const done = setTimeout(() => setN(value), ms + 200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [value, ms]);
  return n;
}

function ScoreRing({ score }: { score: number }) {
  const { tr } = useT();
  score = Number.isFinite(score) ? score : 0; // never show NaN
  const shown = useCountUp(score);
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score >= 85 ? "#22c55e" : score >= 70 ? "#3b82f6" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-border" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={c - (c * score) / 100}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold leading-none tabular-nums">{shown}</span>
        <span className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{tr("out of 100")}</span>
      </div>
    </div>
  );
}

/** Guidelines only the person can resolve (a fact nobody else knows): the button takes them to the form. */
const NEEDS_YOU = new Set(["contact", "education", "experience", "dates", "gaps", "recentExperience"]);

function FixPreview({ fix, jobLabel }: { fix: ReviewFix; jobLabel: string }) {
  const { tr } = useT();
  const box = "mt-2 rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed";
  if (fix.type === "removeJob") {
    return (
      <div className={box}>
        <p className="mb-1 font-semibold text-muted-foreground">{tr("Remove this job")}</p>
        <p className="line-through opacity-70">{jobLabel || tr("The oldest job")}</p>
      </div>
    );
  }
  if (fix.type === "removeJobs") {
    return (
      <div className={box}>
        <p className="mb-1 font-semibold text-muted-foreground">{tr("Remove")}{" "}{fix.jobIds.length}{" "}{tr("old or unrelated job")}{fix.jobIds.length > 1 ? tr("s") : ""}</p>
        <p className="opacity-70">{tr("Your 3 most recent jobs always stay.")}</p>
      </div>
    );
  }
  if (fix.type === "atsClean") {
    return (
      <div className={box}>
        <p className="font-semibold text-muted-foreground">{tr("Remove the photo and skill ratings, and use the plain Classic look")}</p>
      </div>
    );
  }
  if (fix.type === "removeSkills") {
    return (
      <div className={box}>
        <p className="mb-1.5 font-semibold text-muted-foreground">{tr("Remove these skills")}</p>
        <ul className="flex flex-wrap gap-1.5">
          {fix.skills.map((s) => (
            <li key={s} className="rounded-md bg-accent px-2 py-0.5 line-through opacity-70">
              {s}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (fix.type === "objective" || fix.type === "jobTitle") {
    return (
      <div className={box}>
        <p className="mb-1 font-semibold text-muted-foreground">{fix.type === "objective" ? tr("New summary") : tr("New target job")}</p>
        <p>{tr(fix.text)}</p>
      </div>
    );
  }
  if (fix.type === "bullets") {
    return (
      <div className={box}>
        <p className="mb-1 font-semibold text-muted-foreground">{tr("Rewritten bullets")}{jobLabel ? tr(" for {jobLabel}", { jobLabel }) : ""}</p>
        <ul className="space-y-1">
          {fix.bullets.map((b, i) => (
            <li key={i}>• {b}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (fix.type === "sortJobs") {
    return (
      <div className={box}>
        <p className="font-semibold text-muted-foreground">{tr("Put your jobs in order, newest first")}</p>
      </div>
    );
  }
  if (fix.type === "twoPages") {
    return (
      <div className={box}>
        <p className="font-semibold text-muted-foreground">{tr("Keep everything and let the resume run to a second page")}</p>
      </div>
    );
  }
  return (
    <div className={box}>
      <p className="mb-1.5 font-semibold text-muted-foreground">{tr("Skills to add")}</p>
      <ul className="flex flex-wrap gap-1.5">
        {fix.skills.map((s) => (
          <li key={s} className="rounded-md bg-accent px-2 py-0.5">
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The AI looks at the saved profile, gives it a score, lists what to improve and can apply the fixes for the person.
 * Fixes are written to the profile (so the preview next to this panel updates) and saved right away.
 */
// The last review is kept while the page stays open: opening "Customize" and coming back, or switching look, never asks
// the AI again. Only "Check again" does.
type Previous = { verdicts: { id: string; verdict: string }[]; applied: string[]; appliedCriteria?: string[] };
type Kept = {
  profileId: string;
  review: ReviewResult;
  history: { ids: string[]; snap: ProfilePatch }[];
  removedLabels: Record<string, string>;
  previous?: Previous;
};
let kept: Kept | null = null;
/** Suggestions the person discarded, by guideline: a new review does not bring them back. */
let dismissedKeys: string[] = [];
const issueKey = (i: { criterionId?: string; title: string }) => i.criterionId || i.title;
/** Forget the kept review (the details were edited elsewhere, so a new one is needed). */
export const forgetReview = () => {
  kept = null;
};

export default function ResumeReview({
  ready = true,
  template = "classic",
  onProfileChanged,
  onTemplateChange,
}: {
  ready?: boolean;
  template?: string;
  onProfileChanged?: () => void;
  onTemplateChange?: (id: string) => void;
}) {
  const { tr, trd, locale } = useT();
  const {
    activeProfile: profile,
    activeProfileId,
    saveChanges,
    updateCareerObjective,
    updateJobTitle,
    updateSkills,
    setJobHistory,
    updatePhoto,
    updateSkillLevels,
    updatePageGoal,
  } = useProfile();

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState(0);
  // each entry is one apply (a single fix or "fix all") with what it replaced, so it can be undone
  const [history, setHistory] = useState<{ ids: string[]; snap: ProfilePatch }[]>([]);
  const [saveTick, setSaveTick] = useState(0);
  // names of removed jobs, kept so the card still says which job it was after the job is gone
  const [removedLabels, setRemovedLabels] = useState<Record<string, string>>({});
  const toast = useToast();

  const saveRef = useRef(saveChanges);
  saveRef.current = saveChanges;
  useEffect(() => {
    if (saveTick > 0) saveRef.current().catch(() => {});
  }, [saveTick]);

  // rotate the loading message and move a progress bar: it eases towards 90% while the AI works and jumps to 100% when the
  // answer arrives. If the AI takes too long the request is cut (see run) and the person can try again.
  const [progress, setProgress] = useState(0);
  const reported = useRef(0); // the last real progress sent by the server (0 to 99)
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (phase !== "loading") return;
    reported.current = 3;
    setProgress(3);
    setSlow(false);
    const began = Date.now();
    const t = setInterval(() => setMsg((m) => Math.min(m + 1, LOADING_MESSAGES.length - 1)), 2200);
    // The bar follows what the server reports (real stages and the AI's answer as it is written). Between two reports it moves
    // a little, never more than 3 points past the last real one, so it neither jumps nor sits still.
    const bar = setInterval(() => {
      const secs = (Date.now() - began) / 1000;
      const real = reported.current;
      setProgress((p) => Math.max(p, real, Math.min(real + 3, 98, p + 0.25)));
      if (secs > 18) setSlow(true);
    }, 250);
    return () => {
      clearInterval(t);
      clearInterval(bar);
    };
  }, [phase]);

  // what the last review said and which fixes were applied since, so a re-check stays consistent
  const lastCheck = useRef<{ score: number; profileJson: string; template: string } | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const previousRef = useRef<Previous | undefined>(undefined);
  const run = useCallback(async () => {
    if (!activeProfileId) return;
    setPhase("loading");
    setMsg(0);
    setHistory([]);
    setError("");
    const started = Date.now();
    const profileJson = JSON.stringify(profile);
    try {
      // the review reads the saved profile, so make sure what is on screen is saved first
      await saveRef.current().catch(() => {});
      const ctrl = new AbortController();
      const cut = setTimeout(() => ctrl.abort(), 55_000);
      let res: Response;
      try {
        res = await authFetch("/api/review-resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId: activeProfileId, template, previous: previousRef.current, lang: locale, stream: true }),
          signal: ctrl.signal,
        });
      } catch (e) {
        throw new Error((e as Error).name === "AbortError" ? tr("The review is taking too long. Please try again.") : tr("We couldn't reach the server. Check your connection and try again."));
      } finally {
        clearTimeout(cut);
      }
      let data: Record<string, unknown> & { error?: string } = {};
      if ((res.headers.get("content-type") ?? "").includes("ndjson") && res.body) {
        // the server sends one line per step: {"p": 38}, then {"done": true, "result": ...} (or {"error": ...})
        await readNdjson<{ p?: number; done?: boolean; result?: unknown; error?: string }>(res, (msg) => {
          if (typeof msg.p === "number") reported.current = Math.max(reported.current, msg.p);
          if (msg.done) data = msg.result as typeof data;
          if (msg.error) throw new Error(trd(msg.error) || tr("We couldn't review your resume right now."));
        });
        if (!Array.isArray((data as { criteria?: unknown }).criteria)) throw new Error(tr("We couldn't review your resume right now."));
      } else {
        data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(trd(data.error) || tr("We couldn't review your resume right now."));
      }
      setProgress(100);
      // an answer that comes back at once (nothing changed, so it was already known) still shows the check happening
      const wait = 1100 - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const result = data as unknown as ReviewResult;
      const before = lastCheck.current;
      if (before) {
        if (before.profileJson === profileJson) toast.info(tr("Nothing in your resume has changed since the last check, so your score is still {score}. Fix something, then check again.", { score: result.score }));
        else if (result.score > before.score) toast.success(tr("Your score went up: {score} → {v2}.", { score: before.score, v2: result.score }));
        else if (result.score < before.score) toast.info(tr("Your score is now {score} (it was {v2}). The new check found more to improve.", { score: result.score, v2: before.score }));
        else toast.info(tr("Checked again. Your score is still {score}.", { score: result.score }));
      }
      lastCheck.current = { score: result.score, profileJson, template: template ?? "classic" };
      setCheckedAt(new Date());
      setReview(result);
      previousRef.current = {
        verdicts: ((data as unknown as ReviewResult).criteria ?? []).map((c) => ({ id: c.id, verdict: c.verdict })),
        applied: [],
        // what was fixed in this session stays fixed: it is not raised again
        appliedCriteria: previousRef.current?.appliedCriteria ?? [],
      };
      setPhase("ready");
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileId, template, profile]);

  /** "Check again": when nothing changed since the last check it says so and does not ask the AI (no review is used up). */
  const checkAgain = () => {
    const last = lastCheck.current;
    if (last && last.profileJson === JSON.stringify(profile) && last.template === (template ?? "classic") && history.length === 0) {
      toast.info(tr("Nothing in your resume has changed since the last check, so your score is still {score}. Fix something, then check again.", { score: last.score }));
      return;
    }
    run();
  };

  const started = useRef(false);
  useEffect(() => {
    if (started.current || !activeProfileId || !ready) return;
    started.current = true;
    if (kept && kept.profileId === activeProfileId) {
      // coming back (for example from "Customize"): show the same review, nothing is requested
      setReview(reviewForTemplate(kept.review, profile, template ?? "classic"));
      setHistory(kept.history);
      setRemovedLabels(kept.removedLabels);
      previousRef.current = kept.previous;
      lastCheck.current = { score: kept.review.score, profileJson: JSON.stringify(profile), template: template ?? "classic" };
      setPhase("ready");
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileId, ready, run]);

  // remember the review (with what was applied) for when this panel is shown again
  useEffect(() => {
    if (review && activeProfileId) kept = { profileId: activeProfileId, review, history, removedLabels, previous: previousRef.current };
  }, [review, history, removedLabels, activeProfileId]);

  // switching look: same review, only the "easy for ATS" guideline is re-measured (no request)
  const lastTemplate = useRef(template);
  useEffect(() => {
    if (lastTemplate.current === template) return;
    lastTemplate.current = template;
    setReview((r) => (r ? reviewForTemplate(r, profile, template ?? "classic") : r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  const write = (patch: ProfilePatch) => {
    if (patch.careerObjective !== undefined) updateCareerObjective(patch.careerObjective);
    if (patch.jobTitle !== undefined) updateJobTitle(patch.jobTitle);
    if (patch.skills !== undefined) updateSkills(patch.skills);
    if (patch.jobHistory !== undefined) setJobHistory(patch.jobHistory);
    if (patch.photo !== undefined) updatePhoto(patch.photo);
    if (patch.skillLevels !== undefined) updateSkillLevels(patch.skillLevels);
    if (patch.pageGoal !== undefined) updatePageGoal(patch.pageGoal);
    onProfileChanged?.();
    setSaveTick((t) => t + 1);
  };

  // issues the first review left without a ready-made fix: the AI writes it now, for that guideline only
  const [working, setWorking] = useState<string[]>([]);
  // while fixes are being written and saved, "Check again" and the fix buttons wait, so a review never reads a half-saved resume
  const [applying, setApplying] = useState(false);
  // the fixes the person asked for wait in a queue and are carried out ONE BY ONE: each is written, saved and shown in the resume before the
  // next starts (a second fix is built on the resume the first one left, never on an old copy)
  const [queued, setQueued] = useState<string[]>([]);
  const queueRef = useRef<ReviewIssue[]>([]);
  const drainingRef = useRef(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const [dismissed, setDismissed] = useState<string[]>(dismissedKeys);
  const dismiss = (issue: ReviewIssue) => {
    dismissedKeys = [...dismissedKeys, issueKey(issue)];
    setDismissed(dismissedKeys);
  };
  const resolveFix = async (issue: ReviewIssue): Promise<ReviewIssue> => {
    if (issue.fix || !issue.criterionId) return issue;
    await saveRef.current().catch(() => {});
    const res = await authFetch("/api/review-resume/fix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: activeProfileId, template, criterionId: issue.criterionId, lang: locale }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data.fixes) || data.fixes.length === 0) throw new Error(trd(data.error) || tr("I couldn't write that fix. Try again in a moment."));
    return { ...issue, fixes: data.fixes as ReviewFix[], fix: data.fixes[0] as ReviewFix };
  };
  /** Waits until the resume on screen is the one the last fix wrote (or a moment passes), so the next fix starts from it. */
  const settle = async (before: string) => {
    for (let waited = 0; waited < 1500 && JSON.stringify(profileRef.current) === before; waited += 50) await new Promise((r) => setTimeout(r, 50));
  };
  // "Fix all" with a fix about the length of the resume among them: that choice is the person's (cut it to one page, or keep everything on
  // two pages), so it is asked first and NOTHING is applied until it is answered; closing the question applies nothing.
  const [lengthAsk, setLengthAsk] = useState<{ picked: ReviewIssue[]; issue: ReviewIssue } | null>(null);
  const fixAll = (picked: ReviewIssue[]) => {
    const issue = lengthQuestion(picked);
    if (issue) setLengthAsk({ picked, issue });
    else enqueue(picked);
  };
  const answerLength = (pages: "one" | "two") => {
    if (!lengthAsk) return;
    const { picked, issue } = lengthAsk;
    setLengthAsk(null);
    enqueue(withLengthAnswer(picked, issue.id, pages));
  };

  /** Adds fixes to the queue; one that is already queued, being written or applied is not added twice. */
  const enqueue = (picked: ReviewIssue[]) => {
    const fresh = picked.filter((i) => !isApplied(i.id) && !working.includes(i.id) && !queueRef.current.some((q) => q.id === i.id));
    if (fresh.length === 0) return;
    queueRef.current.push(...fresh);
    setQueued(queueRef.current.map((q) => q.id));
    if (!drainingRef.current) void drain();
  };
  const drain = async () => {
    drainingRef.current = true;
    setApplying(true);
    let done = 0;
    try {
      while (queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;
        setQueued(queueRef.current.map((q) => q.id));
        const before = JSON.stringify(profileRef.current);
        if (await applyNow([next], true)) done += 1;
        await settle(before);
      }
      if (done > 1) toast.success(tr("{n} fixes applied and saved", { n: done }) + ".");
      // the fixes are saved right after they are written: give that a moment before a new check can start
      await new Promise((r) => setTimeout(r, 900));
    } finally {
      drainingRef.current = false;
      setApplying(false);
    }
  };
  /** Carries out one fix (or the few of one issue). Returns true when it changed the resume. `quiet` leaves the success message to the queue. */
  const applyNow = async (picked: ReviewIssue[], quiet = false): Promise<boolean> => {
    const profile = profileRef.current; // the resume as the last fix left it
    const pending = picked.filter((i) => !isApplied(i.id));
    if (pending.length === 0) return false;
    let todo: ReviewIssue[] = [];
    try {
      setWorking((w) => [...w, ...pending.map((i) => i.id)]);
      const settled = await Promise.allSettled(pending.map(resolveFix));
      todo = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      const failed = settled.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      if (failed.length && todo.length === 0) throw failed[0].reason;
    } catch (err) {
      toast.error((err as Error).message || tr("We couldn't apply that. Please try again."));
      return false;
    } finally {
      setWorking((w) => w.filter((id) => !pending.some((i) => i.id === id)));
    }
    if (todo.length === 0) return false;
    const couldNot = pending.length - todo.length;
    try {
      const patch = applyFixes(profile, todo.flatMap((i) => (i.fixes ?? [i.fix!])) as ReviewFix[]);
      // a fix can already be in place: then nothing changes, and the person is told instead of seeing nothing happen
      if (!patchChangesProfile(profile, patch)) {
        toast.info(couldNot > 0 ? tr("{couldNot} fix{v1} could not be written. The others were already in your resume, so nothing changed.", { couldNot, v1: couldNot > 1 ? "es" : "" }) : tr("That is already how it is in your resume, so nothing changed. Press Check again to see the score."));
        return false;
      }
      if (todo.some((i) => (i.fixes ?? [i.fix]).some((f) => f?.type === "atsClean"))) onTemplateChange?.("classic");
      const labels: Record<string, string> = {};
      for (const i of todo) if (i.fix?.type === "removeJob") labels[i.id] = jobLabel(i.fix.jobId);
      setRemovedLabels((l) => ({ ...l, ...labels }));
      setHistory((h) => [...h, { ids: todo.map((i) => i.id), snap: snapshotFor(profile, patch) }]);
      if (previousRef.current) {
        previousRef.current = {
          ...previousRef.current,
          applied: [...previousRef.current.applied, ...todo.map((i) => i.title)],
          appliedCriteria: Array.from(new Set([...(previousRef.current.appliedCriteria ?? []), ...todo.map((i) => i.criterionId).filter((x): x is string => !!x)])),
        };
      }
      write(patch);
      const removedJobs = patch.jobHistory !== undefined ? (profile.jobHistory?.length ?? 0) - patch.jobHistory.length : 0;
      const parts = [
        patch.careerObjective !== undefined && "summary rewritten",
        patch.jobTitle !== undefined && "job title updated",
        patch.skills !== undefined && "skills updated",
        // a fix that takes jobs out says how many, so nobody finds out later that the resume has fewer
        patch.jobHistory !== undefined && (removedJobs > 0 ? tr(removedJobs === 1 ? "1 job removed" : "{n} jobs removed", { n: removedJobs }) : "experience updated"),
        (patch.photo !== undefined || patch.skillLevels !== undefined) && "layout made ATS-friendly",
        patch.pageGoal !== undefined && "two pages chosen",
      ].filter(Boolean) as string[];
      if (!quiet) toast.success(`${todo.length === 1 ? tr("Fix applied and saved") : tr("{n} fixes applied and saved", { n: todo.length })}${parts.length ? `: ${parts.map((x) => tr(x)).join(", ")}` : ""}.${couldNot > 0 ? ` ${tr("{n} could not be written, try those again.", { n: couldNot })}` : ` ${tr("Press Check my new score to see the change.")}`}`);
      return true;
    } catch (err) {
      console.error("Applying the fixes failed", err);
      toast.error(tr("We couldn't apply that. Please try again."));
      return false;
    }
  };
  const undo = (id: string) => {
    const entry = history.find((h) => h.ids.includes(id));
    if (!entry) return;
    write(entry.snap);
    setHistory((h) => h.filter((x) => x !== entry));
  };
  const isApplied = (id: string) => history.some((h) => h.ids.includes(id));

  const visibleIssues = (review?.issues ?? []).filter((i) => !dismissed.includes(issueKey(i)));
  // the look is the person's choice: "Fix all" never changes it, only its own button does
  const fixable = visibleIssues.filter((i) => !isApplied(i.id) && i.criterionId !== "atsLayout" && (i.fix || !NEEDS_YOU.has(i.criterionId ?? "")));
  // "Fix all" is available as long as there is at least one fix not asked for yet; what is already waiting or being written is left alone
  const notAskedYet = fixable.filter((i) => !queued.includes(i.id) && !working.includes(i.id));
  const inProgress = queued.length + working.length;
  // issues that only the person can resolve (a phone number...) take them to the form where it goes
  const goTo = (criterionId: string) => {
    const title =
      criterionId === "contact" ? "Contact info and photo"
      : ["role", "summaryLength", "summaryFit"].includes(criterionId) ? "Job you want and summary"
      : criterionId.startsWith("skills") || criterionId.startsWith("keyword") ? "Skills"
      : criterionId === "education" ? "Education"
      : ["experience", "recentExperience", "gaps", "dates", "bulletsPerJob", "bulletLength", "numbers", "strongVerbs", "bulletsQuality"].includes(criterionId) ? "Professional experience"
      : "More to add (optional)";
    const el = document.querySelector(`[data-block="${title}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const jobLabel = (jobId: string) => {
    const j = profile.jobHistory?.find((x) => x.id === jobId);
    return j ? [j.title, j.company].filter(Boolean).join(" · ") : "";
  };

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-500">{tr("AI resume review")}</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-4xl">{tr("How strong is your resume?")}</h1>
          {checkedAt && phase === "ready" && <p className="mt-1 text-sm text-muted-foreground">{tr("Last checked at")}{" "}{checkedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>}
        </div>
        {/* the main action of this panel, always at the top */}
        <Button
          onClick={checkAgain}
          disabled={phase === "loading" || applying || working.length > 0 || queued.length > 0}
          className="h-12 w-full gap-2.5 bg-blue-600 px-6 text-base sm:w-auto font-bold shadow-lg shadow-blue-600/30 transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/35"
        >
          <RotateCcw className={`h-5 w-5 ${phase === "loading" ? "animate-spin" : ""}`} />
          {phase === "loading" ? tr("Checking…") : history.length > 0 ? tr("Check my new score") : tr("Check again")}
        </Button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {phase === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-6 rounded-lg border bg-card p-6"
          >
            <div className="flex items-center gap-5">
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/15" />
                <span className="absolute inset-2 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                <Sparkles className="h-7 w-7 text-blue-500" />
              </div>
              <div className="min-w-0">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={msg}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="text-lg font-semibold"
                  >
                    {tr(LOADING_MESSAGES[msg])}
                  </motion.p>
                </AnimatePresence>
                <p className="mt-1 text-sm text-muted-foreground">{slow ? tr("Still working. This is taking longer than usual, it should finish soon.") : tr("This takes a few seconds. We read your saved resume and look for what to improve.")}</p>
              </div>
            </div>
            <div className="mt-5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label={tr("Reviewing your resume")}>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-blue-500 transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1.5 text-right text-xs tabular-nums text-muted-foreground">{Math.round(progress)}%</p>
            </div>
            <div className="mt-6 space-y-3">
              {[90, 75, 82, 60].map((w, i) => (
                <div key={i} className="shimmer h-3 rounded bg-muted" style={{ width: `${w}%` }} />
              ))}
            </div>
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 rounded-lg border border-red-500/30 bg-red-500/5 p-6">
            <p className="flex items-center gap-2 font-semibold text-red-500">
              <AlertTriangle className="h-5 w-5" />{" "}{tr("We couldn't review it")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button onClick={run} variant="outline" className="mt-4 gap-2">
              <RotateCcw className="h-4 w-4" />{" "}{tr("Try again")}</Button>
          </motion.div>
        )}

        {phase === "ready" && review && (
          <motion.div key="ready" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-4 rounded-xl border bg-card p-4 sm:gap-x-10 sm:gap-y-5 sm:rounded-lg sm:p-6">
              <div className="flex shrink-0 flex-col items-center gap-1.5">
                <ScoreRing score={review.score} />
                {/* how well the resume is written, for any job: the fit with one job is another number, the one of the jobs */}
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tr("Resume score")}</span>
              </div>
              <div className="min-w-0 flex-1 basis-40 sm:basis-60">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{tr("Your level")}</p>
                <p className="mt-1 text-xl font-extrabold sm:text-2xl">{tr(scoreLabel(review.score))}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{trd(review.headline)}</p>
                {review.strengths.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t pt-3 sm:mt-4 sm:pt-4">
                    {review.strengths.map((st) => (
                      <li key={st} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" strokeWidth={3} /> {trd(st)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {review.target && (
              <p className="mt-3 text-xs text-muted-foreground">
                {review.target.kind === "job"
                  ? tr("Judged against the requirements of this job: {role}.", { role: review.target.role })
                  : tr("Judged against a general {v0} resume. When you apply to a specific job, its requirements will be used instead.", { v0: review.target.role || review.target.field })}
              </p>
            )}

            {review.source === "basic" && (
              <p className="mt-3 text-xs text-muted-foreground">{tr("The AI is busy right now, so this is a quick automatic check. Try again in a moment for personalized tips.")}</p>
            )}

            <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:mt-8">
              <h2 className="text-base font-extrabold sm:text-lg">
                {visibleIssues.length === 0 ? tr("Nothing to fix. Nice work.") : tr("{length} thing{v1} to improve", { length: visibleIssues.length, v1: visibleIssues.length > 1 ? "s" : "" })}
              </h2>
              <Dialog open={!!lengthAsk} onOpenChange={(o) => !o && setLengthAsk(null)}>
                <DialogContent className="max-w-md">
                  <DialogTitle className="text-xl font-bold">{tr("One thing to decide before the fixes")}</DialogTitle>
                  <DialogDescription className="text-base leading-relaxed">
                    {tr("Your resume is too long for one page at a readable size. Do you want to cut it to fit one page, or keep everything and use two pages? The other fixes wait for your answer.")}
                  </DialogDescription>
                  <div className="mt-2 flex flex-col gap-2">
                    <Button onClick={() => answerLength("one")} className="h-auto justify-start gap-3 whitespace-normal py-3 text-left">
                      <Wand2 className="h-4 w-4 shrink-0" />
                      <span><span className="block font-bold">{tr("Cut it to one page")}</span><span className="block text-xs font-normal opacity-80">{tr("The least useful details are taken out so it fits.")}</span></span>
                    </Button>
                    <Button onClick={() => answerLength("two")} variant="outline" className="h-auto justify-start gap-3 whitespace-normal py-3 text-left">
                      <Pencil className="h-4 w-4 shrink-0" />
                      <span><span className="block font-bold">{tr("Keep it all: use two pages")}</span><span className="block text-xs font-normal text-muted-foreground">{tr("Nothing is cut; the resume runs over two pages.")}</span></span>
                    </Button>
                    <Button onClick={() => setLengthAsk(null)} variant="ghost" className="text-muted-foreground">{tr("Cancel: apply nothing")}</Button>
                  </div>
                </DialogContent>
              </Dialog>
              {notAskedYet.length > 0 ? (
                <Button onClick={() => fixAll(notAskedYet)} variant="outline" className="h-10 gap-2 border-2 border-blue-600 px-4 font-bold text-blue-600 hover:bg-blue-600 hover:text-white">
                  <Wand2 className="h-4 w-4" />{" "}{tr("Fix all (")}{notAskedYet.length})
                </Button>
              ) : inProgress > 0 ? (
                <Button disabled variant="outline" className="h-10 gap-2 border-2 px-4 font-bold">
                  <Loader2 className="h-4 w-4 animate-spin" />{" "}{tr("Fixing… {n} left", { n: inProgress })}
                </Button>
              ) : null}
            </div>

            {visibleIssues.length > 0 && (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card sm:rounded-lg">
                {visibleIssues.map((issue) => {
                  const done = isApplied(issue.id);
                  return (
                    <motion.li key={issue.id} layout="position" className={`relative py-4 pl-5 pr-3 transition-colors sm:pl-6 sm:pr-4 ${done ? "bg-green-500/5" : ""}`}>
                      <span className={`absolute inset-y-0 left-0 w-1.5 ${done ? "bg-green-500" : IMPACT_STRIPE[issue.impact]}`} aria-hidden />
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-3 sm:flex sm:items-start sm:gap-4">
                        <div className="col-start-1 row-start-1 min-w-0 flex-1">
                          <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${done ? "text-green-500" : IMPACT_TEXT[issue.impact]}`}>
                            {done ? tr("Done") : IMPACT_LABEL[issue.impact]}
                          </p>
                          <p className="mt-0.5 font-bold leading-snug">{trd(issue.title)}</p>
                          {issue.detail && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{trd(issue.detail)}</p>}
                          {issue.fix && <FixPreview fix={issue.fix} jobLabel={issue.fix.type === "bullets" || issue.fix.type === "removeJob" ? removedLabels[issue.id] || jobLabel(issue.fix.jobId) : ""} />}
                        </div>
                        {done ? (
                          <div className="col-span-2 row-start-2 flex shrink-0 items-center justify-between gap-1 sm:flex-col sm:items-end sm:justify-start">
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-500">
                              <Check className="h-4 w-4" />{" "}{tr("Applied")}</span>
                            <button onClick={() => undo(issue.id)} disabled={applying} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40">
                              <Undo2 className="h-3 w-3" />{" "}{tr("Undo")}</button>
                          </div>
                        ) : !issue.fix && NEEDS_YOU.has(issue.criterionId ?? "") ? (
                          <Button size="sm" variant="outline" onClick={() => goTo(issue.criterionId ?? "")} className="col-span-2 row-start-2 h-10 shrink-0 gap-1.5 sm:h-9">
                            <Pencil className="h-3.5 w-3.5" />{" "}{tr("Add it")}</Button>
                        ) : (
                          <div className="col-span-2 row-start-2 flex shrink-0 gap-2 sm:flex-col sm:items-stretch sm:gap-1.5">
                            <Button size="sm" onClick={() => enqueue([issue])} disabled={working.includes(issue.id) || queued.includes(issue.id)} className="h-10 flex-1 gap-1.5 sm:h-9 sm:flex-none">
                              {working.includes(issue.id) || queued.includes(issue.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                              {working.includes(issue.id) ? tr("Writing…") : queued.includes(issue.id) ? tr("Waiting…") : tr("Fix it for me")}
                            </Button>
                            {issue.alt && (
                              <Button size="sm" variant="outline" onClick={() => enqueue([{ ...issue, fix: issue.alt!, fixes: undefined }])} disabled={working.includes(issue.id) || queued.includes(issue.id)} className="h-10 flex-1 gap-1.5 sm:h-9 sm:flex-none">
                                {tr("Keep it all: use two pages")}
                              </Button>
                            )}
                          </div>
                        )}
                        {!done && (
                          <button
                            type="button"
                            onClick={() => dismiss(issue)}
                            disabled={working.includes(issue.id) || queued.includes(issue.id)}
                            title={tr("Dismiss this suggestion")}
                            aria-label={tr("Dismiss this suggestion")}
                            className="col-start-2 row-start-1 -mr-1 -mt-1 h-8 w-8 shrink-0 self-start rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}

            {history.length > 0 && (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-green-500" />{" "}{tr("Changes are saved. Press \"Check my new score\" at the top when you are ready.")}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
