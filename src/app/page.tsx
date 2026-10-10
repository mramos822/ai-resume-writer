"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  SparklesIcon,
  FileTextIcon,
  ShieldCheckIcon,
  DownloadIcon,
  UploadCloudIcon,
  ZapIcon,
  CheckIcon,
  ChevronDownIcon,
  ArrowRightIcon,
  BriefcaseIcon,
} from "lucide-react";
import TopBanner from "@/app/homepage/topBanner";
import Reveal from "@/app/homepage/reveal";
import SiteFooter from "@/components/siteFooter";
import { useAuth } from "@/context/authContext";
import LiveResumeCount from "@/components/liveResumeCount";

/* ---------- Data ---------- */

const steps = [
  {
    n: "01",
    title: "Add your details",
    desc: "Fill in your experience step by step, or upload an existing resume and let us import it.",
    icon: UploadCloudIcon,
  },
  {
    n: "02",
    title: "Paste the job ad",
    desc: "Add the job posting you're targeting so the AI can tailor every line to it.",
    icon: BriefcaseIcon,
  },
  {
    n: "03",
    title: "AI writes it for you",
    desc: "Get polished, keyword-rich bullet points and a clean layout in seconds.",
    icon: SparklesIcon,
  },
  {
    n: "04",
    title: "Download & apply",
    desc: "Export a print-ready PDF and start sending applications right away.",
    icon: DownloadIcon,
  },
];

const templates = [
  { id: "modern", name: "Modern", blurb: "Clean and confident. Great for tech, startups and design roles." },
  { id: "classic", name: "Classic", blurb: "Traditional and timeless. Ideal for finance, law and corporate." },
  { id: "creative", name: "Creative", blurb: "Bold and expressive. Perfect for standing out in creative fields." },
];

const faqs = [
  {
    q: "Is it really free to start?",
    a: "Yes. You can start building right now without an account, and nothing is charged. Make a free account when you want to keep your profile, save several resumes and come back to them from any device.",
    more: "Your details are written once in your profile, so every new resume you make reuses them.",
  },
  {
    q: "Will my resume pass applicant tracking systems (ATS)?",
    a: "Our templates use a clean, single-flow structure with real, selectable text (no images of text, no tables that scramble the order), which is what ATS software parses best.",
    more: "Inside the app, every resume gets an ATS score with the exact checks it passes and the ones to fix, and Kaizo can fix most of them for you with one click.",
  },
  {
    q: "Can I import my existing resume?",
    a: "Yes. Upload your current resume as a PDF or Word file and we extract your experience, education and skills into your profile, so you don't have to retype anything.",
    more: "You review what we found before it is saved, so nothing ends up in your profile without you seeing it.",
  },
  {
    q: "How does the AI tailor my resume to a job?",
    a: "Pick a job (or paste its ad) and the AI reads the requirements, then rewrites the parts of your experience that matter most for that role and writes a cover letter to match.",
    more: "It only works with what is already in your profile. It never invents jobs, degrees or skills you don't have.",
  },
  {
    q: "What formats can I download?",
    a: "PDF, ready to send to employers, and DOCX if the company asks for a Word file or you want to keep editing by hand.",
    more: "Long resumes are fitted automatically so they stay clean and readable instead of spilling a few lines onto a second page.",
  },
  {
    q: "Can I switch templates after writing my resume?",
    a: "Absolutely. Your content is separate from the design, so you can try Classic, Modern and Creative with one click and see each one live before you create it.",
    more: "You can keep one version per look, or one per job you apply to, and find them all in your resumes library.",
  },
  {
    q: "Who can see my information?",
    a: "Only you. Your profile and your resumes are private to your account, and we don't sell or share them.",
    more: "You can delete any resume, or a whole profile, whenever you want, and it is removed for good.",
  },
];

/* ---------- Small pieces ---------- */

function ResumeMock() {
  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* glow */}
      <div className="absolute -inset-6 bg-gradient-to-tr from-teal-300/40 via-blue-300/30 to-indigo-400/40 blur-3xl rounded-full" />

      {/* paper */}
      <div className="relative bg-white rounded-md shadow-2xl border border-gray-200 p-6 rotate-1 hover:rotate-0 transition-transform duration-500">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-indigo-500" />
          <div className="flex-1">
            <div className="h-4 w-40 bg-gray-800 rounded" />
            <div className="h-2.5 w-28 bg-blue-500/70 rounded mt-2" />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="h-2.5 w-24 bg-gray-800 rounded" />
          <div className="h-2 w-full bg-gray-200 rounded" />
          <div className="h-2 w-11/12 bg-gray-200 rounded" />
          <div className="h-2 w-9/12 bg-gray-200 rounded" />
        </div>

        <div className="mt-5 space-y-2">
          <div className="h-2.5 w-28 bg-gray-800 rounded" />
          <div className="flex justify-between">
            <div className="h-2 w-32 bg-gray-400 rounded" />
            <div className="h-2 w-16 bg-gray-300 rounded" />
          </div>
          {/* AI highlighted line */}
          <div className="relative rounded bg-blue-50 border border-blue-200 p-2 space-y-1.5">
            <div className="h-2 w-full bg-blue-200 rounded animate-pulse" />
            <div className="h-2 w-10/12 bg-blue-200 rounded animate-pulse" />
            <span className="absolute -top-2.5 right-2 text-[10px] font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1">
              <SparklesIcon className="w-3 h-3" /> AI improved
            </span>
          </div>
          <div className="h-2 w-10/12 bg-gray-200 rounded" />
        </div>

        <div className="mt-5">
          <div className="h-2.5 w-16 bg-gray-800 rounded mb-2" />
          <div className="flex flex-wrap gap-1.5">
            {["w-14", "w-16", "w-12", "w-20", "w-14"].map((w, i) => (
              <div key={i} className={`h-5 ${w} rounded-md bg-indigo-100`} />
            ))}
          </div>
        </div>
      </div>

      {/* floating chips */}
      <div className="absolute -left-4 sm:-left-10 top-16 bg-white rounded-md shadow-lg border border-gray-100 px-3 py-2 flex items-center gap-2 animate-float">
        <span className="w-7 h-7 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
          <ShieldCheckIcon className="w-4 h-4" />
        </span>
        <div className="text-xs">
          <p className="font-semibold text-gray-900">ATS friendly</p>
          <p className="text-gray-500">Passes the scan</p>
        </div>
      </div>
      <div className="absolute -right-2 sm:-right-8 bottom-24 bg-white rounded-md shadow-lg border border-gray-100 px-3 py-2 flex items-center gap-2 animate-float [animation-delay:1.2s]">
        <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
          <ZapIcon className="w-4 h-4" />
        </span>
        <div className="text-xs">
          <p className="font-semibold text-gray-900">Ready in minutes</p>
          <p className="text-gray-500">Download as PDF</p>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a, more, n }: { q: string; a: string; more?: string; n: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`overflow-hidden rounded-xl border bg-white transition-all duration-300 ${open ? "border-blue-200 shadow-md shadow-blue-600/5" : "border-gray-200 hover:border-gray-300"}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-4 px-5 py-4 text-left" aria-expanded={open}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors ${open ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>{n}</span>
        <span className="flex-1 font-semibold text-gray-900">{q}</span>
        <ChevronDownIcon className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-300 ${open ? "rotate-180 text-blue-600" : ""}`} />
      </button>
      <div className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="space-y-3 px-5 pb-5 sm:pl-[4.25rem]">
            <p className="leading-relaxed text-gray-600">{a}</p>
            {more && (
              <p className="flex gap-2 rounded-lg bg-blue-50 px-3.5 py-2.5 text-sm leading-relaxed text-blue-900">
                <SparklesIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /> {more}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function MarketingPage() {
  const { user } = useAuth();
  const signedIn = !!user && !user.uid.startsWith("guest-");
  const [activeStep, setActiveStep] = useState(0);
  const [tpl, setTpl] = useState(templates[0].id);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const currentTpl = templates.find((t) => t.id === tpl)!;

  return (
    <>
      <TopBanner />
      <main id="main" className="public-site flex flex-col items-center bg-white text-gray-900 font-sans scroll-smooth">
        {/* ============ HERO ============ */}
        <section className="relative w-full pt-32 pb-20 px-4 overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-teal-200/40 rounded-full blur-3xl" />
          <div className="absolute top-40 -right-24 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl" />

          <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-semibold px-3 py-1 rounded-md border border-blue-100 mb-6">
                <SparklesIcon className="w-4 h-4" /> AI-powered resume builder
              </span>
              <h1 className="text-5xl sm:text-6xl font-extrabold mb-6 leading-[1.05] tracking-tight">
                Build a resume that{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-indigo-500">
                  gets you hired
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-xl">
                Tell us about yourself, paste the job ad, and our AI writes a polished,
                tailored resume you can download in minutes. No design skills needed.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link
                  href={signedIn ? "/home" : "/start"}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-4 rounded-md shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5"
                >
                  {signedIn ? "Go to dashboard" : "Create my resume"} <ArrowRightIcon className="w-5 h-5" />
                </Link>
                <a
                  href="#templates"
                  className="inline-flex items-center justify-center border border-gray-300 hover:border-blue-600 hover:text-blue-600 font-semibold px-7 py-4 rounded-md transition"
                >
                  Browse templates
                </a>
              </div>

              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                {["Free to start", "No design skills needed", "ATS-friendly"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CheckIcon className="w-4 h-4 text-green-600" /> {t}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={150}>
              <ResumeMock />
            </Reveal>
          </div>
        </section>

        {/* ============ STATS BAR ============ */}
        <section className="w-full px-4 pb-4">
          <Reveal>
            <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 rounded-lg border border-gray-200 bg-white shadow-sm p-6 text-center">
              <LiveResumeCount />
              {[
                { v: "~10 min", l: "to a finished resume" },
                { v: "3", l: "professional templates" },
                { v: "PDF + DOCX", l: "ready to send" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="text-3xl font-extrabold text-blue-600">{s.v}</p>
                  <p className="text-sm text-gray-600 mt-1">{s.l}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ============ HOW IT WORKS ============ */}
        <section id="how" className="w-full py-24 px-4 scroll-mt-16">
          <Reveal>
            <h2 className="text-4xl font-extrabold text-center mb-3 tracking-tight">
              From blank page to job-ready in 4 steps
            </h2>
            <p className="text-center text-gray-600 mb-14 max-w-2xl mx-auto">
              A guided flow that does the heavy lifting so you can focus on landing interviews.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const active = index === activeStep;
              return (
                <Reveal key={step.title} delay={index * 100}>
                  <div
                    onMouseEnter={() => setActiveStep(index)}
                    className={`h-full p-6 rounded-lg border transition-all duration-500 ${
                      active
                        ? "bg-white border-blue-300 shadow-xl -translate-y-1"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <span
                        className={`w-12 h-12 rounded-md flex items-center justify-center transition-colors ${
                          active ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-600"
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                      </span>
                      <span className="text-3xl font-black text-gray-200">{step.n}</span>
                    </div>
                    <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                    <p className="text-gray-600 text-sm">{step.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* ============ AI BEFORE / AFTER ============ */}
        <section className="w-full py-24 px-4 bg-gray-950 text-white">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 text-teal-300 text-sm font-semibold mb-4">
                <SparklesIcon className="w-4 h-4" /> AI WRITING ASSISTANT
              </span>
              <h2 className="text-4xl font-extrabold tracking-tight mb-5">
                Say goodbye to writer&apos;s block
              </h2>
              <p className="text-gray-300 text-lg mb-6">
                Describe what you did in your own words. Kaizo rewrites it into
                clear, results-driven bullet points that recruiters notice.
              </p>
              <ul className="space-y-3">
                {[
                  "Action verbs and measurable impact",
                  "Keywords pulled straight from the job ad",
                  "Consistent tone across every section",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-gray-200">
                    <CheckIcon className="w-5 h-5 text-teal-300 mt-0.5 shrink-0" /> {t}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={150}>
              <div className="space-y-4">
                <div className="rounded-lg bg-white/5 border border-white/10 p-5">
                  <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Before</p>
                  <p className="text-gray-300">
                    Worked at a store, helped customers and did the register, also trained new people.
                  </p>
                </div>
                <div className="flex justify-center">
                  <span className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                    <SparklesIcon className="w-5 h-5" />
                  </span>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-400/40 p-5">
                  <p className="text-xs uppercase tracking-wider text-teal-300 mb-2">After</p>
                  <ul className="space-y-2 text-white list-disc pl-5">
                    <li>Delivered exceptional customer service to 100+ shoppers daily.</li>
                    <li>Processed transactions accurately in a fast-paced retail environment.</li>
                    <li>Trained and onboarded new team members, improving team readiness.</li>
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============ FEATURES ============ */}
        <section id="features" className="w-full py-24 px-4 bg-sky-50 scroll-mt-16">
          <Reveal>
            <h2 className="text-4xl font-extrabold text-center mb-3 tracking-tight">Less typing, a better resume</h2>
            <p className="text-center text-gray-600 mb-14 max-w-2xl mx-auto">Here is what Kaizo does for you, so you only have to check the result.</p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {/* bullets */}
            <Reveal className="md:col-span-2">
              <div className="h-full rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-7 text-white">
                <h3 className="text-2xl font-bold">Your notes, written like a pro</h3>
                <p className="mt-1.5 max-w-md text-blue-100">Say what you did in your own words. Kaizo turns it into a bullet that shows what you achieved.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <p className="rounded-lg bg-white/10 px-4 py-3 text-sm leading-relaxed text-blue-100">Worked at a store, helped customers and did the register.</p>
                  <ArrowRightIcon className="mx-auto h-5 w-5 rotate-90 text-amber-300 sm:rotate-0" />
                  <p className="rounded-lg bg-white px-4 py-3 text-sm font-medium leading-relaxed text-gray-900">Served customers at a busy store and handled cash and card payments accurately every shift.</p>
                </div>
              </div>
            </Reveal>

            {/* ATS */}
            <Reveal delay={70}>
              <div className="h-full rounded-xl border border-gray-200 bg-white p-7">
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" stroke="#e5e7eb" />
                      <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" strokeLinecap="round" stroke="#22c55e" strokeDasharray="264" strokeDashoffset="8" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xl font-black tabular-nums">97</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold leading-tight">Made for ATS software</h3>
                    <p className="text-sm text-gray-500">16 of 17 checks pass</p>
                  </div>
                </div>
                <p className="mt-4 text-gray-600">Real text in a clean order, so the systems that screen resumes read all of it. Every resume gets a score, and Kaizo fixes what fails.</p>
              </div>
            </Reveal>

            {/* tailoring */}
            <Reveal delay={90}>
              <div className="h-full rounded-xl border border-gray-200 bg-white p-7">
                <div className="rounded-lg bg-gray-50 p-3.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">Fit with this job</span>
                    <span className="font-extrabold text-blue-600">82%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full w-[82%] rounded-full bg-blue-600" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    {["React", "SQL", "Git"].map((t) => (
                      <span key={t} className="rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-700">{t}</span>
                    ))}
                    <span className="rounded-full border border-gray-300 px-2.5 py-0.5 text-gray-500">Docker</span>
                  </div>
                </div>
                <h3 className="mt-5 text-lg font-bold">One job, one resume</h3>
                <p className="mt-1 text-gray-600">See how you match a posting, what it asks that you don&apos;t have yet, and get a resume and cover letter made for it.</p>
              </div>
            </Reveal>

            {/* templates */}
            <Reveal delay={110}>
              <div className="h-full rounded-xl border border-gray-200 bg-white p-7">
                <div className="flex gap-2.5">
                  {[
                    <div key="c" className="flex-1 space-y-1 p-1.5"><div className="mx-auto h-1.5 w-10 bg-gray-800" /><div className="h-px bg-gray-300" />{[0, 1, 2, 3].map((i) => <div key={i} className="h-1 bg-gray-200" />)}</div>,
                    <div key="m" className="flex flex-1 gap-1 p-1.5"><div className="w-1/3 space-y-1"><div className="h-1.5 bg-gray-800" />{[0, 1, 2].map((i) => <div key={i} className="h-1 bg-gray-200" />)}</div><div className="flex-1 space-y-1">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-1 bg-gray-200" />)}</div></div>,
                    <div key="x" className="flex flex-1 flex-col"><div className="h-6 bg-blue-600" /><div className="space-y-1 p-1.5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-1 bg-gray-200" />)}</div></div>,
                  ].map((sheet, i) => (
                    <div key={i} className="flex aspect-[3/4] flex-1 overflow-hidden rounded-sm bg-white shadow ring-1 ring-black/10">
                      {sheet}
                    </div>
                  ))}
                </div>
                <h3 className="mt-5 text-lg font-bold">Change the look, keep the words</h3>
                <p className="mt-1 text-gray-600">Classic, Modern or Creative. Switch whenever you want, your content stays exactly as it is.</p>
              </div>
            </Reveal>

            {/* import */}
            <Reveal delay={130}>
              <div className="h-full rounded-xl border border-gray-200 bg-white p-7">
                <div className="flex items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3.5">
                  <FileTextIcon className="h-8 w-8 shrink-0 text-blue-600" />
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-semibold">old_resume.pdf</p>
                    <p className="flex items-center gap-1 text-green-600"><CheckIcon className="h-3.5 w-3.5" /> Jobs, school and skills found</p>
                  </div>
                </div>
                <h3 className="mt-5 text-lg font-bold">Start from the resume you have</h3>
                <p className="mt-1 text-gray-600">Upload a PDF or Word file and it fills your profile in. You check it, you don&apos;t retype it.</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============ TEMPLATES ============ */}
        <section id="templates" className="w-full py-24 px-4 scroll-mt-16">
          <Reveal>
            <h2 className="text-4xl font-extrabold text-center mb-3 tracking-tight">
              Templates recruiters love
            </h2>
            <p className="text-center text-gray-600 mb-10 max-w-2xl mx-auto">
              Pick a look. Switch anytime, your content stays exactly as it is.
            </p>
          </Reveal>

          <div className="flex justify-center gap-2 mb-10">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setTpl(t.id)}
                className={`px-5 py-2 rounded-md text-sm font-semibold border transition ${
                  tpl === t.id
                    ? "bg-blue-600 text-white border-blue-600 shadow"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-600"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
            <div className="relative mx-auto w-full max-w-sm">
              <div className="absolute -inset-4 bg-gradient-to-tr from-teal-200/50 to-indigo-300/50 blur-2xl rounded-lg" />
              <div className="relative rounded-md overflow-hidden border border-gray-200 shadow-2xl bg-white">
                <Image
                  key={currentTpl.id}
                  src={`/templates/${currentTpl.id}.png`}
                  alt={`${currentTpl.name} template`}
                  width={400}
                  height={520}
                  className="w-full h-auto animate-fadeIn"
                />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-extrabold mb-3">{currentTpl.name} template</h3>
              <p className="text-gray-600 text-lg mb-6">{currentTpl.blurb}</p>
              <ul className="space-y-2 mb-8 text-gray-700">
                {["ATS-friendly structure", "Print-ready PDF export", "Change template in one click"].map(
                  (t) => (
                    <li key={t} className="flex items-center gap-2">
                      <CheckIcon className="w-5 h-5 text-green-600" /> {t}
                    </li>
                  )
                )}
              </ul>
              <Link
                href={signedIn ? "/home/resumes/new" : "/start"}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-md transition"
              >
                Use this template <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section id="faq" className="w-full py-24 px-4 scroll-mt-16">
          <Reveal>
            <h2 className="text-4xl font-extrabold text-center mb-3 tracking-tight">
              Frequently asked questions
            </h2>
            <p className="text-center text-gray-600 mb-12">Everything you need to know before you start.</p>
          </Reveal>
          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((f, i) => (
              <FaqItem key={f.q} n={i + 1} {...f} />
            ))}
          </div>
        </section>

        {/* ============ FINAL CTA ============ */}
        <section className="w-full px-4 pb-24">
          <Reveal>
            <div className="max-w-5xl mx-auto rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white text-center px-6 py-16 shadow-2xl">
              <h2 className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight">
                Your next job starts with a great resume
              </h2>
              <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
                {signedIn ? "Your resumes are waiting in your dashboard." : "Create your free account and build your resume in minutes."}
              </p>
              <Link
                href={signedIn ? "/home" : "/start"}
                className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold px-8 py-4 rounded-md hover:bg-blue-50 transition hover:-translate-y-0.5 shadow-lg"
              >
                {signedIn ? "Go to dashboard" : "Get started free"} <ArrowRightIcon className="w-5 h-5" />
              </Link>
            </div>
          </Reveal>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
