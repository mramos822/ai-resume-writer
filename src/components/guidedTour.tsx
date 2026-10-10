// src/components/guidedTour.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Rocket,
  UploadCloud,
  UserRound,
  Briefcase,
  Download,
  Lightbulb,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/context/profileContext";
import { getProfileProgress } from "@/lib/profileProgress";

export const OPEN_TOUR_EVENT = "kaizo:open-tour";
const STORAGE_KEY = "kaizo_tour_done";

export function openTour() {
  window.dispatchEvent(new Event(OPEN_TOUR_EVENT));
}

const STEPS = [
  {
    icon: Rocket,
    title: "Welcome to Kaizo",
    body: "In about ten minutes you'll have a resume tailored to a real job. This quick tour shows how everything fits together.",
    tip: "You can reopen this tour any time from the ? button at the top.",
  },
  {
    icon: UploadCloud,
    title: "1. Add what you've done",
    body: "On the Dashboard, upload an old resume or write a short bio. We read it and fill your profile, so you don't retype anything.",
    tip: "PDF and Word files both work. More documents means better results.",
    href: "/home",
    cta: "Go to Dashboard",
  },
  {
    icon: UserRound,
    title: "2. Check your profile",
    body: "Open Profile to review contact info, skills, jobs and education. Fix anything the import got wrong. The progress bar shows what's missing.",
    tip: "Add numbers when you can: 'served 100+ customers a day' beats 'helped customers'.",
    href: "/home/profile",
    cta: "Open Profile",
  },
  {
    icon: Briefcase,
    title: "3. Paste the job ad",
    body: "In Resumes, press New resume and paste the posting you want. Kaizo reads what they ask for and tailors your resume to it, and gives you advice on how well you match.",
    tip: "A different ad gives a different resume, so save one per job you apply to.",
    href: "/home/resumes/new",
    cta: "Make a resume",
  },
  {
    icon: Download,
    title: "4. Generate and download",
    body: "Pick a template, generate, preview it and download the PDF. Everything you make is saved in Resumes so you can come back to it.",
    tip: "You can switch templates after generating. Your content stays put.",
    href: "/home/resumes",
    cta: "See Resumes",
  },
  {
    icon: Lightbulb,
    title: "You're ready",
    body: "Stuck at any point? The Help center has short guides and answers to common questions.",
    tip: "Start by importing a document. It's the fastest way in.",
    href: "/home/help",
    cta: "Open Help center",
  },
];

export default function GuidedTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const { profiles, activeProfile } = useProfile();
  // New, empty accounts get the setup wizard instead of this tour
  const hasData = profiles.length > 0 && getProfileProgress(activeProfile).doneCount > 0;

  // First visit: show once
  useEffect(() => {
    if (!hasData) return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      /* storage unavailable: skip auto-open */
    }
  }, [hasData]);

  useEffect(() => {
    const handler = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_TOUR_EVENT, handler);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, handler);
  }, []);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, []);

  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;
  const pct = ((step + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : finish())}>
      <DialogContent showCloseButton={false} className="max-w-lg gap-0 overflow-hidden p-0">
        {/* progress */}
        <div className="h-1.5 w-full bg-muted">
          <div
            className="h-full bg-blue-600 transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div key={step} className="animate-pop-in p-7">
          <div className="mb-5 flex items-center justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Icon className="h-6 w-6" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>

          <DialogTitle className="text-2xl font-bold leading-tight">{s.title}</DialogTitle>
          <DialogDescription className="mt-2 text-base leading-relaxed text-muted-foreground">
            {s.body}
          </DialogDescription>

          <div className="mt-5 flex gap-3 rounded-md border bg-accent/60 p-3 text-sm">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p className="text-muted-foreground">{s.tip}</p>
          </div>

          {s.href && (
            <Link
              href={s.href}
              onClick={finish}
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"
            >
              {s.cta} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-muted/50 px-7 py-4">
          <button
            onClick={finish}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {last ? "Close" : "Skip tour"}
          </button>

          <div className="hidden items-center gap-1.5 sm:flex">
            {STEPS.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to step ${i + 1}`}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all ${
                  i === step ? "w-6 bg-blue-600" : "w-2 bg-border hover:bg-muted-foreground"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((n) => n - 1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? finish() : setStep((n) => n + 1))}>
              {last ? "Get started" : "Next"} {!last && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
