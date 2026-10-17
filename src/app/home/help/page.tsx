// src/app/home/help/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "@/i18n/navigation";
import { motion } from "framer-motion";
import {
  Search,
  PlayCircle,
  UploadCloud,
  UserRound,
  Briefcase,
  Download,
  Plus,
  LifeBuoy,
  BookOpen,
  SearchX,
} from "lucide-react";
import { openTour } from "@/components/guidedTour";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useT } from "@/i18n/provider";

const GUIDES = [
  {
    icon: UploadCloud,
    title: "1. Import your history",
    time: "2 min",
    steps: [
      "Go to the Dashboard and find “Import your professional history”.",
      "Drop in an old resume (PDF or Word), or switch to “Write a bio” and type a few paragraphs.",
      "Under “Your uploads”, press Parse on the file. We read it and fill in your profile.",
    ],
    href: "/home",
    cta: "Go to Dashboard",
  },
  {
    icon: UserRound,
    title: "2. Review your profile",
    time: "3 min",
    steps: [
      "Open Profile from the menu. Each section (contact, objective, skills, jobs, education) has its own block.",
      "Check what the import filled in and correct anything that's wrong.",
      "Watch the Profile strength bar grow as you complete sections.",
    ],
    href: "/home/profile",
    cta: "Open Profile",
  },
  {
    icon: Briefcase,
    title: "3. Add a job ad",
    time: "1 min",
    steps: [
      "Open Resumes, press New resume, and paste the text of a posting you want to apply to (optional).",
      "Save it. Kaizo reads the requirements and can give advice on how well you match.",
      "Add one ad per job, so each resume is tailored to a different role.",
    ],
    href: "/home/resumes/new",
    cta: "Make a resume"
  },
  {
    icon: Download,
    title: "4. Generate and download",
    time: "1 min",
    steps: [
      "With a job ad selected, choose a template and press Generate.",
      "Preview the result. You can switch templates without losing anything.",
      "Download the PDF, or find it later in Resumes.",
    ],
    href: "/home/resumes",
    cta: "See Resumes",
  },
];

const FAQS = [
  {
    q: "Where do I start?",
    a: "On the Dashboard, import an old resume or write a short bio. That fills your profile automatically, and the checklist there tells you what's next.",
  },
  {
    q: "What file types can I upload?",
    a: "PDF and Word documents work, and you can also paste plain text with “Write a bio”. If a file can't be read, try pasting its text instead.",
  },
  {
    q: "The import got something wrong. What now?",
    a: "Open Profile and edit that section directly. The import is a starting point, and everything is editable.",
  },
  {
    q: "What is the Profile strength bar?",
    a: "It shows how complete your profile is: contact info, objective, skills, jobs and education. A fuller profile gives better resumes.",
  },
  {
    q: "Can I keep more than one profile?",
    a: "Yes. Use the profile menu on the Dashboard to add, rename or delete profiles, for example one for each career direction.",
  },
  {
    q: "How is my resume tailored to a job?",
    a: "You paste a job ad. The AI reads what the employer asks for, then emphasizes and rewords the parts of your experience that match.",
  },
  {
    q: "What does ATS-friendly mean?",
    a: "Many companies scan resumes with Applicant Tracking Systems before a person sees them. Our templates use plain, readable text so those systems can parse them.",
  },
  {
    q: "Can I change the template later?",
    a: "Yes. Your content and design are separate, so try every template on the same resume.",
  },
  {
    q: "Where are my generated resumes?",
    a: "In Resumes. You can preview, download or delete them there.",
  },
  {
    q: "How do I delete a file, job or profile?",
    a: "Use the trash or remove button next to it. You'll always be asked to confirm first, so nothing disappears by accident.",
  },
];

const GLOSSARY = [
  { term: "ATS", def: "Applicant Tracking System. Software employers use to scan and sort resumes." },
  { term: "Parse", def: "Read a document and pull the useful details (jobs, skills, education) into your profile." },
  { term: "Template", def: "The look of your resume. Changing it never changes your words." },
  { term: "Tailoring", def: "Rewording your resume to match the requirements in a specific job ad." },
];

export default function HelpPage() {
  const { tr } = useT();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    // the search looks in the text the person reads (in their language)
    return FAQS.filter((f) => tr(f.q).toLowerCase().includes(q) || tr(f.a).toLowerCase().includes(q));
  }, [query, tr]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border bg-gradient-to-br from-blue-600 to-indigo-600 p-8 text-white"
      >
        <span className="mb-3 inline-flex items-center gap-2 rounded-md bg-white/15 px-3 py-1 text-sm font-medium">
          <LifeBuoy className="h-4 w-4" />{" "}{tr("Help center")}</span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{tr("How can we help?")}</h1>
        <p className="mt-2 max-w-xl text-blue-100">{tr("Short guides, answers to common questions, and a tour if you'd like to see everything at once.")}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label={tr("Search help")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(null);
              }}
              placeholder={tr("Search questions, e.g. “upload” or “template”")}
              className="h-11 w-full rounded-md border-0 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/60"
            />
          </div>
          <Button onClick={openTour} className="h-11 gap-2 bg-white text-blue-700 hover:bg-blue-50">
            <PlayCircle className="h-4 w-4" />{" "}{tr("Take the tour")}</Button>
        </div>
      </motion.div>

      {/* Guides */}
      <section>
        <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
          <BookOpen className="h-5 w-5 text-blue-600" />{" "}{tr("Quick-start guides")}</h2>
        <p className="mb-5 text-sm text-muted-foreground">{tr("Follow these in order. The whole thing takes about ten minutes.")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {GUIDES.map(({ icon: Icon, title, time, steps, href, cta }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-blue-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{tr(time)}</span>
                  </div>
                  <CardTitle className="mt-3">{tr(title)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    {steps.map((s, n) => (
                      <li key={n} className="flex gap-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-blue-600">
                          {n + 1}
                        </span>
                        {tr(s)}
                      </li>
                    ))}
                  </ol>
                  <Link href={href} className="mt-4 inline-flex min-h-6 items-center text-sm font-semibold text-blue-600 hover:underline">
                    {tr(cta)} →
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="mb-1 text-xl font-bold">{tr("Frequently asked questions")}</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          {query ? tr("{length} result{v1} for “{query}”", { length: results.length, v1: results.length === 1 ? "" : "s", query }) : tr("Tap a question to see the answer.")}
        </p>

        {results.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed py-12 text-center">
            <SearchX className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">{tr("Nothing matched that search")}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{tr("Try a shorter word, or take the tour to see how everything works.")}</p>
            <Button variant="outline" className="mt-4" onClick={() => setQuery("")}>{tr("Clear search")}</Button>
          </div>
        ) : (
          <div className="divide-y rounded-lg border bg-card">
            {results.map((f) => {
              const isOpen = open === f.q;
              return (
                <div key={f.q}>
                  <button
                    onClick={() => setOpen(isOpen ? null : f.q)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium hover:bg-accent/50"
                  >
                    {tr(f.q)}
                    <Plus
                      className={`h-5 w-5 shrink-0 text-blue-600 transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
                    />
                  </button>
                  <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden">
                      <p className="px-5 pb-4 text-sm text-muted-foreground">{tr(f.a)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Glossary */}
      <section>
        <h2 className="mb-4 text-xl font-bold">{tr("Words you'll see")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="rounded-lg border bg-card p-4">
              <p className="font-semibold text-blue-600">{tr(g.term)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{tr(g.def)}</p>
            </div>
          ))}
        </div>
      </section>

      <Card className="border-blue-200 bg-accent/50">
        <CardHeader>
          <CardTitle>{tr("Still stuck?")}</CardTitle>
          <CardDescription>{tr("Go back to the Dashboard. Its checklist always shows the very next step for you.")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/home">{tr("Back to Dashboard")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
