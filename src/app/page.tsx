"use client";

import { usePopularTemplates } from "@/lib/usePopularTemplates";
import { PopularRibbon } from "@/components/popularRibbon";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "@/i18n/navigation";
import {
  SparklesIcon,
  FileTextIcon,
  ShieldCheckIcon,
  DownloadIcon,
  UploadCloudIcon,
  ZapIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  BriefcaseIcon,
} from "lucide-react";
import TopBanner from "@/app/homepage/topBanner";
import Reveal from "@/app/homepage/reveal";
import SiteFooter from "@/components/siteFooter";
import { TEMPLATES, supportsPhoto, supportsSkillLevels, TWO_COLUMN } from "@/lib/templates";
import { useAuth } from "@/context/authContext";
import LiveResumeCount from "@/components/liveResumeCount";
import { useT } from "@/i18n/provider";

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

const templates = TEMPLATES.map((t) => ({ id: t.id, name: t.name.replace(" (Default)", ""), blurb: t.blurb }));

/** The four tiles of "how it works": how big each is, its color, where the words go and where the picture comes out. */
const HOW_TILES = [
  { span: "lg:col-span-5 lg:row-span-2", bg: "bg-gradient-to-br from-indigo-50 to-blue-100", text: "max-w-[24rem]", img: "-bottom-6 -right-6 h-[58%]" },
  { span: "lg:col-span-4", bg: "bg-gradient-to-br from-teal-50 to-sky-100", text: "max-w-[55%] max-lg:max-w-none", img: "-bottom-4 -right-4 h-[62%]" },
  { span: "lg:col-span-3", bg: "bg-gradient-to-br from-violet-50 to-indigo-100", text: "", img: "-bottom-4 -right-4 h-[34%]" },
  { span: "lg:col-span-7", bg: "bg-gradient-to-br from-amber-50 to-emerald-100", text: "max-w-[42%] max-lg:max-w-none", img: "-bottom-6 right-4 h-[88%]" },
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
  const { tr } = useT();
  return (
    <div className="relative w-full max-w-md xl:max-w-xl mx-auto">
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
              <SparklesIcon className="w-3 h-3" />{" "}{tr("AI improved")}</span>
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
          <p className="font-semibold text-gray-900">{tr("ATS friendly")}</p>
          <p className="text-gray-500">{tr("Passes the scan")}</p>
        </div>
      </div>
      <div className="absolute -right-2 sm:-right-8 bottom-24 bg-white rounded-md shadow-lg border border-gray-100 px-3 py-2 flex items-center gap-2 animate-float [animation-delay:1.2s]">
        <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
          <ZapIcon className="w-4 h-4" />
        </span>
        <div className="text-xs">
          <p className="font-semibold text-gray-900">{tr("Ready in minutes")}</p>
          <p className="text-gray-500">{tr("Download as PDF")}</p>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a, more, n }: { q: string; a: string; more?: string; n: number }) {
  const { tr } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className={`overflow-hidden rounded-xl border bg-white transition-all duration-300 ${open ? "border-blue-200 shadow-md shadow-blue-600/5" : "border-gray-200 hover:border-gray-300"}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-4 px-5 py-4 text-left" aria-expanded={open}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors ${open ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>{n}</span>
        <span className="flex-1 font-semibold text-gray-900">{tr(q)}</span>
        <ChevronDownIcon className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-300 ${open ? "rotate-180 text-blue-600" : ""}`} />
      </button>
      <div className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="space-y-3 px-5 pb-5 sm:pl-[4.25rem]">
            <p className="leading-relaxed text-gray-600">{tr(a)}</p>
            {more && (
              <p className="flex gap-2 rounded-lg bg-blue-50 px-3.5 py-2.5 text-sm leading-relaxed text-blue-900">
                <SparklesIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /> {tr(more)}
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
  const isPopular = usePopularTemplates(); // the three looks with the most resumes
  const { tr } = useT();
  const { user } = useAuth();
  const signedIn = !!user && !user.uid.startsWith("guest-");
  const [tpl, setTpl] = useState(templates[0].id);
  // how many resumes were made with each look (registered accounts), shown above the look being previewed
  const [lookCounts, setLookCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then((d) => setLookCounts(d?.templates ?? null)).catch(() => {});
  }, []);

  const shown = templates;
  const currentTpl = templates.find((t) => t.id === tpl)!;
  // its place among the looks by resumes made (1 = the most used); 0 while there is nothing to rank
  const rank = lookCounts && (lookCounts[currentTpl.id] ?? 0) > 0 ? 1 + templates.filter((t) => (lookCounts[t.id] ?? 0) > (lookCounts[currentTpl.id] ?? 0)).length : 0;
  const step = (by: number) => setTpl(templates[(shown.findIndex((t) => t.id === currentTpl.id) + by + templates.length) % templates.length].id);
  // The ribbon holds the list three times in a row and rests on the middle copy. Moving goes with a slide; when it has gone into the first
  // or the last copy it jumps (with no slide) to the same place in the middle one, so there is no end: after the last comes the first.
  const total = templates.length;
  const [offset, setOffset] = useState(total);
  const [animate, setAnimate] = useState(true);
  const move = (by: number) => {
    setAnimate(true);
    setOffset((o) => o + by);
  };
  const settle = () => {
    if (offset >= total * 2 || offset < total) {
      setAnimate(false);
      setOffset((o) => ((o % total) + total) % total + total);
    }
  };

  return (
    <>
      <TopBanner />
      <main id="main" className="public-site flex flex-col items-center bg-white text-gray-900 font-sans scroll-smooth">
        {/* ============ HERO ============ */}
        <section className="relative w-full pt-32 pb-20 px-4 lg:px-12 overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white">
          {/* a faint dot grid that fades out towards the edges */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-60 [background-image:radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black,transparent)]"
          />
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-teal-200/40 rounded-full blur-3xl" />
          <div className="absolute top-40 -right-24 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl" />

          <div className="relative max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 xl:gap-24 items-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-semibold px-3 py-1 rounded-md border border-blue-100 mb-6">
                <SparklesIcon className="w-4 h-4" />{" "}{tr("AI-powered resume builder")}</span>
              <h1 className="text-5xl sm:text-6xl xl:text-7xl font-extrabold mb-6 leading-[1.05] tracking-tight">{tr("Build a resume that")}{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-indigo-500">{tr("gets you hired")}</span>
              </h1>
              <p className="text-xl xl:text-2xl text-gray-600 mb-8 max-w-2xl">{tr("Tell us about yourself, paste the job ad, and our AI writes a polished, tailored resume you can download in minutes. No design skills needed.")}</p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link
                  href={signedIn ? "/home" : "/start"}
                  className="group inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-4 rounded-md shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5"
                >
                  {signedIn ? tr("Go to dashboard") : tr("Create my resume")} <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  href="#templates"
                  className="inline-flex items-center justify-center border border-gray-300 hover:border-blue-600 hover:text-blue-600 font-semibold px-7 py-4 rounded-md transition"
                >{tr("Browse templates")}</a>
              </div>

              {!signedIn && (
                <p className="mb-5 -mt-3 text-xs text-gray-500">{tr("By continuing you confirm you are 16 or older and accept the")}{" "}<Link href="/terms" className="underline">{tr("Terms")}</Link>{" "}{tr("and")}{" "}<Link href="/privacy" className="underline">{tr("Privacy Policy")}</Link>.
                </p>
              )}
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                {["Free to start", "No design skills needed", "ATS-friendly"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CheckIcon className="w-4 h-4 text-green-600" /> {tr(t)}
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
        <section className="w-full px-4 lg:px-12 pb-4">
          <Reveal>
            <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 rounded-lg border border-gray-200 bg-white shadow-sm p-6 text-center md:gap-0 md:divide-x md:divide-gray-100 [&>*]:md:px-4">
              <LiveResumeCount />
              {[
                { v: "~10 min", l: "to a finished resume" },
                { v: String(TEMPLATES.length), l: "professional templates" },
                { v: "PDF + DOCX", l: "ready to send" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="text-3xl font-extrabold text-blue-600">{s.v}</p>
                  <p className="text-sm text-gray-600 mt-1">{tr(s.l)}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ============ HOW IT WORKS: a grid of four tiles of different sizes, each with its picture coming out of a corner ============ */}
        <section id="how" className="w-full py-14 px-4 lg:px-10 scroll-mt-16">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-2 tracking-tight">{tr("From blank page to job-ready in 4 steps")}</h2>
            <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">{tr("A guided flow that does the heavy lifting so you can focus on landing interviews.")}</p>
          </Reveal>
          <div className="mx-auto grid w-full gap-4 lg:grid-cols-12 lg:grid-rows-2">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const tile = HOW_TILES[i];
              return (
                <Reveal key={step.title} delay={i * 110} className={tile.span}>
                  <article className={`group relative h-full min-h-[12.5rem] overflow-hidden rounded-3xl border border-white/60 p-6 shadow-sm transition-shadow duration-500 hover:shadow-xl ${tile.bg}`}>
                    {/* a big number, very faint, behind everything */}
                    <span aria-hidden className="pointer-events-none absolute -right-2 -top-6 select-none text-[9rem] font-black leading-none text-black/[0.045]">{step.n}</span>
                    <div className={`relative z-10 ${tile.text}`}>
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-indigo-600 shadow-sm transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="mt-3 text-xl font-extrabold tracking-tight">{tr(step.title)}</h3>
                      <p className="mt-1 text-sm text-gray-600">{tr(step.desc)}</p>
                    </div>
                    {/* the picture comes out of the corner and leans over to you when the pointer is on the tile */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/how/step-${i + 1}.webp`}
                      alt=""
                      width={900}
                      height={840}
                      loading="lazy"
                      draggable={false}
                      className={`absolute max-lg:static max-lg:mx-auto max-lg:mt-4 max-lg:block max-lg:!h-32 w-auto drop-shadow-xl transition-transform duration-700 ease-out group-hover:-translate-y-2 group-hover:rotate-2 group-hover:scale-[1.06] ${tile.img}`}
                    />
                  </article>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* ============ AI BEFORE / AFTER ============ */}
        <section className="w-full py-24 px-4 lg:px-12 bg-gray-950 text-white">
          <div className="max-w-[1600px] mx-auto grid lg:grid-cols-2 gap-14 xl:gap-24 items-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 text-teal-300 text-sm font-semibold mb-4">
                <SparklesIcon className="w-4 h-4" />{" "}{tr("AI WRITING ASSISTANT")}</span>
              <h2 className="text-4xl font-extrabold tracking-tight mb-5">{tr("Say goodbye to writer's block")}</h2>
              <p className="text-gray-300 text-lg mb-6">{tr("Describe what you did in your own words. Kaizo rewrites it into clear, results-driven bullet points that recruiters notice.")}</p>
              <ul className="space-y-3">
                {[
                  "Action verbs and measurable impact",
                  "Keywords pulled straight from the job ad",
                  "Consistent tone across every section",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-gray-200">
                    <CheckIcon className="w-5 h-5 text-teal-300 mt-0.5 shrink-0" /> {tr(t)}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={150}>
              <div className="space-y-4">
                <div className="rounded-lg bg-white/5 border border-white/10 p-5">
                  <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">{tr("Before")}</p>
                  <p className="text-gray-300">{tr("Worked at a store, helped customers and did the register, also trained new people.")}</p>
                </div>
                <div className="flex justify-center">
                  <span className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                    <SparklesIcon className="w-5 h-5" />
                  </span>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-400/40 p-5">
                  <p className="text-xs uppercase tracking-wider text-teal-300 mb-2">{tr("After")}</p>
                  <ul className="space-y-2 text-white list-disc pl-5">
                    <li>{tr("Delivered exceptional customer service to 100+ shoppers daily.")}</li>
                    <li>{tr("Processed transactions accurately in a fast-paced retail environment.")}</li>
                    <li>{tr("Trained and onboarded new team members, improving team readiness.")}</li>
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============ FEATURES ============ */}
        <section id="features" className="w-full py-24 px-4 lg:px-12 bg-sky-50 scroll-mt-16">
          <Reveal>
            <h2 className="text-4xl font-extrabold text-center mb-3 tracking-tight">{tr("Less typing, a better resume")}</h2>
            <p className="text-center text-gray-600 mb-14 max-w-2xl mx-auto">{tr("Here is what Kaizo does for you, so you only have to check the result.")}</p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[1600px] mx-auto">
            {/* bullets */}
            <Reveal className="md:col-span-2">
              <div className="h-full rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-7 text-white">
                <h3 className="text-2xl font-bold">{tr("Your notes, written like a pro")}</h3>
                <p className="mt-1.5 max-w-md text-blue-100">{tr("Say what you did in your own words. Kaizo turns it into a bullet that shows what you achieved.")}</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <p className="rounded-lg bg-white/10 px-4 py-3 text-sm leading-relaxed text-blue-100">{tr("Worked at a store, helped customers and did the register.")}</p>
                  <ArrowRightIcon className="mx-auto h-5 w-5 rotate-90 text-amber-300 sm:rotate-0" />
                  <p className="rounded-lg bg-white px-4 py-3 text-sm font-medium leading-relaxed text-gray-900">{tr("Served customers at a busy store and handled cash and card payments accurately every shift.")}</p>
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
                    <h3 className="text-lg font-bold leading-tight">{tr("Made for ATS software")}</h3>
                    <p className="text-sm text-gray-500">{tr("16 of 17 checks pass")}</p>
                  </div>
                </div>
                <p className="mt-4 text-gray-600">{tr("Real text in a clean order, so the systems that screen resumes read all of it. Every resume gets a score, and Kaizo fixes what fails.")}</p>
              </div>
            </Reveal>

            {/* tailoring */}
            <Reveal delay={90}>
              <div className="h-full rounded-xl border border-gray-200 bg-white p-7">
                <div className="rounded-lg bg-gray-50 p-3.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">{tr("Fit with this job")}</span>
                    <span className="font-extrabold text-blue-600">82%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full w-[82%] rounded-full bg-blue-600" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    {["React", "SQL", "Git"].map((t) => (
                      <span key={t} className="rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-700">{tr(t)}</span>
                    ))}
                    <span className="rounded-full border border-gray-300 px-2.5 py-0.5 text-gray-500">{tr("Docker")}</span>
                  </div>
                </div>
                <h3 className="mt-5 text-lg font-bold">{tr("One job, one resume")}</h3>
                <p className="mt-1 text-gray-600">{tr("See how you match a posting, what it asks that you don't have yet, and get a resume and cover letter made for it.")}</p>
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
                <h3 className="mt-5 text-lg font-bold">{tr("Change the look, keep the words")}</h3>
                <p className="mt-1 text-gray-600">{tr("Classic, Modern or Creative. Switch whenever you want, your content stays exactly as it is.")}</p>
              </div>
            </Reveal>

            {/* import */}
            <Reveal delay={130}>
              <div className="h-full rounded-xl border border-gray-200 bg-white p-7">
                <div className="flex items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3.5">
                  <FileTextIcon className="h-8 w-8 shrink-0 text-blue-600" />
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-semibold">{tr("old_resume.pdf")}</p>
                    <p className="flex items-center gap-1 text-green-600"><CheckIcon className="h-3.5 w-3.5" />{" "}{tr("Jobs, school and skills found")}</p>
                  </div>
                </div>
                <h3 className="mt-5 text-lg font-bold">{tr("Start from the resume you have")}</h3>
                <p className="mt-1 text-gray-600">{tr("Upload a PDF or Word file and it fills your profile in. You check it, you don't retype it.")}</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============ TEMPLATES ============ */}
        <section id="templates" className="w-full py-24 px-4 lg:px-12 scroll-mt-16">
          <Reveal>
            <h2 className="text-4xl font-extrabold text-center mb-3 tracking-tight">{tr("Templates recruiters love")}</h2>
            <p className="text-center text-gray-600 mb-10 max-w-2xl mx-auto">{tr("Pick a look. Switch anytime, your content stays exactly as it is.")}</p>
          </Reveal>

          {/* the look being shown: big, with what it is for */}
          <div className="mx-auto grid max-w-[1100px] items-center gap-10 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-16">
            <div className="relative mx-auto w-full max-w-xs">
              <div className="absolute -inset-4 bg-gradient-to-tr from-teal-200/50 to-indigo-300/50 blur-2xl rounded-lg" />
              <div className="relative rounded-md overflow-hidden border border-gray-200 shadow-2xl bg-white">
                {isPopular(currentTpl.id) && <PopularRibbon />}
                <Image
                  key={currentTpl.id}
                  src={`/templates/${currentTpl.id}.png`}
                  alt={tr("{name} template", { name: tr(currentTpl.name) })}
                  width={400}
                  height={520}
                  className="w-full h-auto animate-fadeIn"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-blue-600">{String(shown.findIndex((t) => t.id === currentTpl.id) + 1).padStart(2, "0")} / {String(shown.length).padStart(2, "0")}</p>
                <div className="flex gap-2">
                  <button onClick={() => step(-1)} aria-label={tr("Previous template")} className="flex h-9 w-9 items-center justify-center rounded-full border bg-white transition hover:border-blue-600 hover:text-blue-600"><ChevronLeftIcon className="h-4 w-4" /></button>
                  <button onClick={() => step(1)} aria-label={tr("Next template")} className="flex h-9 w-9 items-center justify-center rounded-full border bg-white transition hover:border-blue-600 hover:text-blue-600"><ChevronRightIcon className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${((shown.findIndex((t) => t.id === currentTpl.id) + 1) / shown.length) * 100}%` }} /></div>
              <h3 className="mt-5 text-3xl font-extrabold">{tr(currentTpl.name)}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  isPopular(currentTpl.id) ? tr("Popular") : "",
                  TWO_COLUMN.includes(currentTpl.id as never) ? tr("Two columns") : tr("Single column"),
                  supportsPhoto(currentTpl.id) ? tr("Photo optional") : tr("No photo"),
                  supportsSkillLevels(currentTpl.id) ? tr("Skill ratings") : "",
                ].filter(Boolean).map((c) => (
                  <span key={c} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{c}</span>
                ))}
              </div>
              <p className="mt-4 text-lg text-gray-600">{tr(currentTpl.blurb)}</p>
              {lookCounts && (
                <div className="mt-5 flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
                  <p className="text-3xl font-extrabold tabular-nums text-blue-600">{(lookCounts[currentTpl.id] ?? 0).toLocaleString()}</p>
                  <div className="text-sm">
                    <p className="font-semibold text-gray-800">{(lookCounts[currentTpl.id] ?? 0) === 1 ? tr("resume made with this look") : tr("resumes made with this look")}</p>
                    {rank > 0 && <p className="text-gray-500">{tr("#{n} most used", { n: rank })}</p>}
                  </div>
                </div>
              )}
              <ul className="mt-5 space-y-2 text-gray-700">
                {[TWO_COLUMN.includes(currentTpl.id as never) ? "Clear columns, easy to scan" : "ATS-friendly structure", "Print-ready PDF export", "Change template in one click"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckIcon className="w-5 h-5 text-green-600" /> {tr(t)}
                  </li>
                ))}
              </ul>
              <Link
                href={signedIn ? "/home/resumes/new" : "/start"}
                className="mt-7 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-md transition"
              >{tr("Use this template")}{" "}<ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* the ribbon: the sheets in a row that you move with the arrows; at the end of the list it starts again, so it never runs out */}
          <div className="relative mx-auto mt-14 max-w-[1500px]" role="group" aria-label={tr("Templates")} onKeyDown={(e) => { if (e.key === "ArrowRight") move(3); if (e.key === "ArrowLeft") move(-3); }}>
            <button onClick={() => move(-3)} aria-label={tr("Previous templates")} className="absolute left-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-lg transition hover:scale-105">
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button onClick={() => move(3)} aria-label={tr("Next templates")} className="absolute right-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-lg transition hover:scale-105">
              <ChevronRightIcon className="h-5 w-5" />
            </button>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-white to-transparent" />
            <div className="overflow-hidden py-8">
              <div
                className={`flex w-max gap-6 px-6 ${animate ? "transition-transform duration-500 ease-out" : ""}`}
                style={{ transform: `translateX(-${offset * 200}px)` }}
                onTransitionEnd={settle}
              >
                {[0, 1, 2].map((copy) =>
                  templates.map((t) => {
                    const on = t.id === currentTpl.id;
                    return (
                      <button
                        key={`${copy}-${t.id}`}
                        onClick={() => setTpl(t.id)}
                        aria-pressed={on}
                        aria-hidden={copy !== 1}
                        tabIndex={copy === 1 ? 0 : -1}
                        className={`group/card w-44 shrink-0 text-left transition-all duration-300 ${on ? "scale-105" : "opacity-85 hover:opacity-100"}`}
                      >
                        <span className={`relative block overflow-hidden rounded-md border bg-white transition-all duration-300 ${on ? "border-blue-600 shadow-2xl ring-2 ring-blue-600" : "border-gray-200 shadow-md group-hover/card:-translate-y-1 group-hover/card:shadow-xl"}`}>
                          {isPopular(t.id) && <PopularRibbon />}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/templates/${t.id}.png`} alt={copy === 1 ? tr("{v0} preview", { v0: tr(t.name) }) : ""} draggable={false} loading="lazy" width={176} height={249} className="h-auto w-full" />
                        </span>
                        <span className={`mt-3 block text-center text-sm font-semibold ${on ? "text-blue-600" : "text-gray-700"}`}>{tr(t.name)}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section id="faq" className="w-full py-24 px-4 scroll-mt-16">
          <Reveal>
            <h2 className="text-4xl font-extrabold text-center mb-3 tracking-tight">{tr("Frequently asked questions")}</h2>
            <p className="text-center text-gray-600 mb-12">{tr("Everything you need to know before you start.")}</p>
          </Reveal>
          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((f, i) => (
              <FaqItem key={f.q} n={i + 1} {...f} />
            ))}
          </div>
        </section>

        {/* ============ FINAL CTA: the last block of the page, flush with the footer, with a wave on top ============ */}
        <section className="relative mt-6 w-full overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white">
          {/* the wave: the white of the page flows into the color */}
          <svg aria-hidden viewBox="0 0 1440 56" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-8 w-full text-white sm:h-12">
            <path fill="currentColor" d="M0 0h1440v22c-120 26-240 34-360 22S840 4 720 6 480 40 360 44 120 38 0 14Z" />
          </svg>
          {/* two soft waves inside, moving slowly */}
          <svg aria-hidden viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-20 w-[200%] animate-wave text-white/10">
            <path fill="currentColor" d="M0 60c120-40 240-40 360 0s240 40 360 0 240-40 360 0 240 40 360 0v60H0Z" />
          </svg>
          <svg aria-hidden viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-14 w-[200%] animate-wave text-white/10 [animation-duration:26s] [animation-direction:reverse]">
            <path fill="currentColor" d="M0 70c120-40 240-40 360 0s240 40 360 0 240-40 360 0 240 40 360 0v50H0Z" />
          </svg>

          <div className="relative mx-auto flex max-w-[1200px] flex-col items-center gap-8 px-4 pb-14 pt-16 text-center sm:pt-20 md:flex-row md:justify-between md:text-left lg:px-12">
            <Reveal>
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{tr("Your next job starts with a great resume")}</h2>
              <p className="mt-2 max-w-md text-blue-100">
                {signedIn ? tr("Your resumes are waiting in your dashboard.") : tr("Create your free account and build your resume in minutes.")}
              </p>
              <Link
                href={signedIn ? "/home" : "/start"}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 font-bold text-blue-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50"
              >
                {signedIn ? tr("Go to dashboard") : tr("Get started free")} <ArrowRightIcon className="h-5 w-5" />
              </Link>
            </Reveal>

            {/* two blank sheets, drawn with bars like a template with nothing written, that float a little */}
            <div aria-hidden className="relative hidden h-40 w-56 shrink-0 md:block">
              <div className="absolute left-0 top-4 w-24 -rotate-6 animate-float">
                <div className="space-y-1.5 rounded-sm border border-white/30 bg-white p-2.5 shadow-xl shadow-black/25">
                  <div className="h-2 w-2/3 rounded-full bg-indigo-300" />
                  <div className="h-1 w-1/2 rounded-full bg-gray-200" />
                  <div className="my-1.5 h-px w-full bg-gray-200" />
                  <div className="h-1 w-1/3 rounded-full bg-indigo-200" />
                  <div className="h-1 w-full rounded-full bg-gray-200" />
                  <div className="h-1 w-5/6 rounded-full bg-gray-200" />
                  <div className="h-1 w-1/3 rounded-full bg-indigo-200 mt-2" />
                  <div className="h-1 w-full rounded-full bg-gray-200" />
                  <div className="h-1 w-4/5 rounded-full bg-gray-200" />
                  <div className="h-1 w-3/5 rounded-full bg-gray-200" />
                </div>
              </div>
              <div className="absolute right-0 top-0 w-24 rotate-6 animate-float [animation-delay:1s]">
                <div className="flex overflow-hidden rounded-sm border border-white/30 bg-white shadow-xl shadow-black/25">
                  <div className="w-1/3 space-y-1.5 bg-indigo-700 p-2">
                    <div className="mx-auto h-4 w-4 rounded-full bg-indigo-300" />
                    <div className="h-1 w-full rounded-full bg-indigo-400" />
                    <div className="h-1 w-3/4 rounded-full bg-indigo-400" />
                    <div className="h-1 w-5/6 rounded-full bg-indigo-400" />
                  </div>
                  <div className="flex-1 space-y-1.5 p-2.5">
                    <div className="h-2 w-3/4 rounded-full bg-gray-700" />
                    <div className="h-1 w-1/2 rounded-full bg-indigo-300" />
                    <div className="h-1 w-1/3 rounded-full bg-gray-300 mt-2" />
                    <div className="h-1 w-full rounded-full bg-gray-200" />
                    <div className="h-1 w-5/6 rounded-full bg-gray-200" />
                    <div className="h-1 w-1/3 rounded-full bg-gray-300 mt-2" />
                    <div className="h-1 w-full rounded-full bg-gray-200" />
                    <div className="h-1 w-4/5 rounded-full bg-gray-200" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
