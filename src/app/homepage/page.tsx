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
  TargetIcon,
  LayoutTemplateIcon,
  ZapIcon,
  CheckIcon,
  ChevronDownIcon,
  ArrowRightIcon,
  LightbulbIcon,
  BriefcaseIcon,
} from "lucide-react";
import TopBanner from "@/app/homepage/topBanner";
import Testimonials from "@/app/homepage/testimonials";
import Reveal from "@/app/homepage/reveal";

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

const features = [
  {
    icon: SparklesIcon,
    title: "AI-written content",
    desc: "Turn rough notes into strong, achievement-focused bullet points.",
    className: "md:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-600 text-white",
    dark: true,
  },
  {
    icon: TargetIcon,
    title: "Tailored to each job",
    desc: "Paste a job ad and get a resume matched to its requirements.",
    className: "bg-white",
  },
  {
    icon: ShieldCheckIcon,
    title: "ATS-friendly",
    desc: "Clean structure that applicant tracking systems can actually read.",
    className: "bg-white",
  },
  {
    icon: LayoutTemplateIcon,
    title: "Professional templates",
    desc: "Modern, classic and creative designs. Switch anytime, content stays.",
    className: "bg-white",
  },
  {
    icon: LightbulbIcon,
    title: "Job-ad advice",
    desc: "Get tips on how your profile matches a role and what to improve.",
    className: "bg-white",
  },
  {
    icon: FileTextIcon,
    title: "Import your old resume",
    desc: "Upload a PDF or document and skip the retyping.",
    className: "md:col-span-3 lg:col-span-1 bg-white",
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
    a: "Yes. You can create an account, build your profile and try the resume builder for free.",
  },
  {
    q: "Will my resume pass applicant tracking systems (ATS)?",
    a: "Our templates use a clean, single-flow structure with real text (not images), which is what ATS software parses best.",
  },
  {
    q: "Can I import my existing resume?",
    a: "Yes. Upload your current resume and we'll extract your experience and education into your profile so you don't have to retype it.",
  },
  {
    q: "How does the AI tailor my resume to a job?",
    a: "Paste the job ad and the AI reads its requirements, then highlights and rewrites the parts of your experience that matter most for that role.",
  },
  {
    q: "What formats can I download?",
    a: "You can download your finished resume as a PDF, ready to send to employers.",
  },
  {
    q: "Can I switch templates after writing my resume?",
    a: "Absolutely. Your content is separate from the design, so you can try every template with one click.",
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

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 font-semibold text-gray-900"
        aria-expanded={open}
      >
        {q}
        <ChevronDownIcon
          className={`w-5 h-5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-4 text-gray-600">{a}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function MarketingPage() {
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
      <main className="flex flex-col items-center bg-white text-gray-900 font-sans scroll-smooth">
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
                  href="/?view=register"
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-4 rounded-md shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5"
                >
                  Create my resume <ArrowRightIcon className="w-5 h-5" />
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
              {[
                { v: "~10 min", l: "to a finished resume" },
                { v: "3", l: "professional templates" },
                { v: "PDF", l: "print-ready export" },
                { v: "100%", l: "tailored to the job ad" },
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

        {/* ============ FEATURES (bento) ============ */}
        <section id="features" className="w-full py-24 px-4 bg-sky-50 scroll-mt-16">
          <Reveal>
            <h2 className="text-4xl font-extrabold text-center mb-3 tracking-tight">
              Everything you need to get the interview
            </h2>
            <p className="text-center text-gray-600 mb-14 max-w-2xl mx-auto">
              Smart tools built into one simple builder.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal key={f.title} delay={i * 70} className={f.className.includes("col-span-2") ? "md:col-span-2" : f.className.includes("col-span-3") ? "md:col-span-3 lg:col-span-1" : ""}>
                  <div
                    className={`h-full rounded-lg border p-7 transition hover:-translate-y-1 hover:shadow-xl ${
                      f.dark ? "border-transparent bg-gradient-to-br from-blue-600 to-indigo-600 text-white" : "border-gray-200 bg-white"
                    }`}
                  >
                    <span
                      className={`w-12 h-12 rounded-md flex items-center justify-center mb-5 ${
                        f.dark ? "bg-white/20" : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </span>
                    <h3 className="font-bold text-xl mb-2">{f.title}</h3>
                    <p className={f.dark ? "text-blue-50" : "text-gray-600"}>{f.desc}</p>
                  </div>
                </Reveal>
              );
            })}
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
                href="/?view=register"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-md transition"
              >
                Use this template <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ============ TESTIMONIALS ============ */}
        <Testimonials />

        {/* ============ FAQ ============ */}
        <section id="faq" className="w-full py-24 px-4 scroll-mt-16">
          <Reveal>
            <h2 className="text-4xl font-extrabold text-center mb-3 tracking-tight">
              Frequently asked questions
            </h2>
            <p className="text-center text-gray-600 mb-12">Everything you need to know before you start.</p>
          </Reveal>
          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((f) => (
              <FaqItem key={f.q} {...f} />
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
                Create your free account and build your resume in minutes.
              </p>
              <Link
                href="/?view=register"
                className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold px-8 py-4 rounded-md hover:bg-blue-50 transition hover:-translate-y-0.5 shadow-lg"
              >
                Get started free <ArrowRightIcon className="w-5 h-5" />
              </Link>
            </div>
          </Reveal>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="w-full border-t border-gray-200 bg-gray-50 px-4 py-10">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <Image src="/kaizologo.png" alt="Kaizo" width={130} height={16} />
            <nav className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
              <a href="#how" className="hover:text-blue-600">How it works</a>
              <a href="#features" className="hover:text-blue-600">Features</a>
              <a href="#templates" className="hover:text-blue-600">Templates</a>
              <a href="#faq" className="hover:text-blue-600">FAQ</a>
              <Link href="/?view=login" className="hover:text-blue-600">Log in</Link>
            </nav>
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} Kaizo Resume Builder</p>
          </div>
        </footer>
      </main>
    </>
  );
}
