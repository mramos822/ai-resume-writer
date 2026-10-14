// src/components/livePreview.tsx
"use client";

import { asResumeLang, formatMonth, type ResumeLang } from "@/lib/dateFormat";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Award, BookUser, Briefcase, Building2, FolderKanban, GraduationCap, Github, Globe, Heart, Home, Languages, Linkedin, Mail, Palette, Settings, Smartphone, User } from "lucide-react";

import { formatContactPhone } from "@/lib/phone";
import { orderedSections } from "@/lib/sectionOrder";
import { levelDots, levelFraction, type LanguageEntry } from "@/lib/languages";
import { skillLevel, type SkillLevels } from "@/lib/skillLevels";
import { groupSkills, hasSkillGroups, type SkillGroups } from "@/lib/skillGroups";
import { displayUrl, labeledLink, shortContactLink, type CertificationEntry, type LinkEntry } from "@/lib/links";
import { useT } from "@/i18n/provider";
import { accentHex, accentVars } from "@/lib/accents";
import { BLOBS, DROPS, pastelPalette, smoothPath } from "@/lib/blobs";
import { PHOTO_RADIUS, photoShapeOf, type PhotoShape } from "@/lib/templates";

export type PreviewJob = {
  company: string;
  title: string;
  location?: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  bullets?: string[];
};

export type PreviewEdu = {
  school: string;
  degree: string;
  location?: string;
  startDate: string;
  endDate: string;
  current: boolean;
  gpa?: string;
  honors?: string;
  coursework?: string;
};

export type PreviewData = {
  name: string;
  photo?: string;
  email: string;
  phone: string;
  address: string;
  /** ISO code of the country, so the phone is printed the way that country writes it */
  countryCode?: string;
  jobTitle: string;
  objective: string;
  skills: string[];
  languages?: LanguageEntry[];
  skillLevels?: SkillLevels;
  skillGroups?: SkillGroups;
  /** id of the color the look wears (see lib/accents) */
  accent?: string;
  /** grow the text to fill the page when there is little content (off = natural size) */
  fillPage?: boolean;
  links?: LinkEntry[];
  certifications?: CertificationEntry[];
  interests?: string[];
  /** order of the resume sections chosen by the person (see lib/sectionOrder) */
  sectionOrder?: string[];
  projects?: { name: string; link?: string; technologies: string[]; startDate?: string; endDate?: string; current?: boolean; description?: string; bullets: string[] }[];
  internships?: PreviewJob[];
  job: PreviewJob;
  /** every job, most recent first (falls back to `job`) */
  jobs?: PreviewJob[];
  edu: PreviewEdu;
  /** every school, most recent first (falls back to `edu`) */
  edus?: PreviewEdu[];
};

export type PreviewSection = "contact" | "about" | "skills" | "job" | "education" | null;

// The sheet is drawn in the language of the page (set by LivePreview before it draws): months, "Present" and levels.
let SHEET_LANG: ResumeLang = "en";
const monthLabel = (v: string) => (/^\d{4}-\d{2}$/.test(v) ? formatMonth(v, SHEET_LANG) : "");
const period = (start: string, end: string, current: boolean) =>
  [monthLabel(start), current ? (SHEET_LANG === "es" ? "Actualidad" : "Present") : monthLabel(end)].filter(Boolean).join(" — ");
const LEVEL_ES: Record<string, string> = { Native: "Nativo", Fluent: "Fluido", Advanced: "Avanzado", Intermediate: "Intermedio", Basic: "Básico" };
const levelText = (l: string) => (SHEET_LANG === "es" ? LEVEL_ES[l] ?? l : l);

// Everything is sized in cqw (1% of the paper's width), so the page scales like a real sheet of paper.
const f = (n: number): React.CSSProperties => ({ fontSize: `${n}cqw` });
const GRAY = "#e4e4e4";
// never above 1: a short resume stays small on the sheet, exactly like the generated PDF
/** The most the text may grow when there is little to say (forms that already fill the page stay at 1). */
const MAX_GROW = 1.3;
/** Blossom has room to spare, so its text may grow more. */
const MAX_GROW_BLOSSOM = 1.5;
// these keep the base size: the forms already fill the page, and in two columns the text grown to fill the main column looks too big
const FORM_TEMPLATES = ["rirekisho", "shokumu", "modern", "creative", "sidebar", "noir", "pastel", "atelier"];
const SCALES = [1, 0.96, 0.92, 0.88, 0.84, 0.8, 0.76, 0.72, 0.68, 0.64, 0.6, 0.56, 0.52, 0.48, 0.44, 0.4];

// the photo takes the shape of the look being drawn (set by LivePreview before it draws)
let SHEET_PHOTO: PhotoShape = "circle";
function Photo({ src, size, style }: { src: string; size: number; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{ width: `${size}cqw`, height: `${size}cqw`, borderRadius: `${PHOTO_RADIUS[SHEET_PHOTO] * 100}%`, objectFit: "cover", flexShrink: 0, ...style }}
    />
  );
}

/** The soft shapes of the pastel look: three strips of the page (top, middle, bottom), each drawn with the paths of the PDF. */
function PastelBack({ base, photo }: { base: string; photo?: string }) {
  const P = pastelPalette(base);
  const path = (key: keyof typeof BLOBS) => smoothPath(BLOBS[key].pts);
  /** A shape and the drops that fly off it, in one color. */
  const shape = (key: keyof typeof BLOBS, color: string) => (
    <>
      <path d={path(key)} fill={color} />
      {(DROPS[key] ?? []).map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={color} />)}
    </>
  );
  const strip = (box: [number, number, number, number], style: React.CSSProperties, children: React.ReactNode) => (
    <svg viewBox={box.join(" ")} preserveAspectRatio="none" style={{ position: "absolute", left: 0, width: "100%", ...style }} aria-hidden>{children}</svg>
  );
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: P.paper }} />
      {strip([0, 0, 595, 300], { top: 0, height: "50.4cqw" }, (
        <>
          <path d={path("mint")} fill={P.mint} />
          {photo && (
            <>
              <clipPath id="pastel-photo"><path d={path("photo")} /></clipPath>
              <image href={photo} x={400} y={0} width={195} height={190} preserveAspectRatio="xMidYMid slice" clipPath="url(#pastel-photo)" />
            </>
          )}
          {shape("ink", P.ink)}
        </>
      ))}
      {strip([0, 340, 595, 220], { top: "57.1cqw", height: "37cqw" }, shape("right", P.lavenderSoft))}
      {strip([0, 640, 595, 202], { bottom: 0, height: "27cqw" }, (
        <>
          {shape("left", P.lavender)}
          <path d={path("pinkSoft")} fill={P.lavenderSoft} />
          {shape("pink", P.pink)}
          <path d={path("center")} fill={P.ink} />
        </>
      ))}
    </>
  );
}

function Skel({ w, center = false, mt = "0.8cqw" }: { w: string; center?: boolean; mt?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: center ? "center" : "flex-start", marginTop: mt }}>
      <div style={{ width: w, height: "1.3cqw", background: GRAY, borderRadius: "0.7cqw" }} />
    </div>
  );
}

function Bars({ widths }: { widths: string[] }) {
  return (
    <div style={{ display: "grid", gap: "1cqw" }}>
      {widths.map((w, i) => (
        <div key={i} style={{ width: w, height: "1.1cqw", background: GRAY, borderRadius: "0.6cqw" }} />
      ))}
    </div>
  );
}

/** Soft blue glow around the section the person is filling in right now. */
const glow = (on: boolean): React.CSSProperties =>
  on
    ? { background: "rgba(37,99,235,0.06)", boxShadow: "0 0 0 0.9cqw rgba(37,99,235,0.06), 0 0 0 1.1cqw rgba(37,99,235,0.22)", borderRadius: "0.6cqw" }
    : { transition: "all .3s" };

/** Room kept free on the first line of an entry for the small place name that sits at the right edge, so long text never runs under it. */
/** Five stars drawn as shapes, filled up to the level. Shapes, not text glyphs: no fallback font has to load, so they show instantly. */
const StarRow = ({ level }: { level: number }) => (
  <span style={{ display: "inline-flex", gap: "0.25cqw", verticalAlign: "middle" }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <svg key={i} viewBox="0 0 24 24" style={{ width: "1.7cqw", height: "1.7cqw" }} aria-hidden>
        <polygon points="12,1.5 15.2,8.6 23,9.4 17.2,14.7 18.9,22.5 12,18.5 5.1,22.5 6.8,14.7 1,9.4 8.8,8.6" fill={i <= level ? "#1a1a1a" : "none"} stroke="#1a1a1a" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ))}
  </span>
);
/** Five dots (filled up to the level), drawn as shapes. */
const DotRow = ({ level }: { level: number }) => (
  <span style={{ display: "inline-flex", gap: "0.7cqw", verticalAlign: "middle" }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <span key={i} style={{ width: "1.1cqw", height: "1.1cqw", borderRadius: "50%", boxSizing: "border-box", border: "0.2cqw solid #1a1a1a", background: i <= level ? "#1a1a1a" : "transparent" }} />
    ))}
  </span>
);
const placeRoom = (place?: string) => (place?.trim() ? `${Math.min(30, place.trim().length * 0.85 + 2.5)}cqw` : undefined);

/** The classic sample person (like the template documents of a word processor), shown until something is written. */
const SAMPLE: PreviewData = {
  name: "John Doe",
  email: "john.doe@example.com",
  phone: "(555) 555-0123",
  address: "123 Main Street, Springfield, IL",
  jobTitle: "Marketing Manager",
  objective:
    "Results-driven marketing manager with 8 years of experience planning campaigns, growing online audiences and leading small teams. Skilled at turning data into clear plans that raise brand awareness and sales. Looking to bring creative strategy and reliable execution to a growing company.",
  skills: ["Campaign Planning", "Social Media", "SEO", "Google Analytics", "Content Strategy", "Team Leadership", "Budgeting", "Public Speaking"],
  job: { company: "Contoso Ltd.", title: "Marketing Manager", location: "Springfield, IL", startDate: "2020-03", endDate: "", current: true, description: "", bullets: [] },
  jobs: [
    {
      company: "Contoso Ltd.",
      title: "Marketing Manager",
      location: "Springfield, IL",
      startDate: "2020-03",
      endDate: "",
      current: true,
      description: "",
      bullets: ["Led a team of 5 to launch 12 campaigns, raising qualified leads by 38%.", "Managed a $250,000 annual budget and cut cost per lead by 21%."],
    },
    {
      company: "Fabrikam Inc.",
      title: "Marketing Specialist",
      location: "Chicago, IL",
      startDate: "2016-06",
      endDate: "2020-02",
      current: false,
      description: "",
      bullets: ["Grew the email list from 4,000 to 15,000 subscribers in two years.", "Wrote weekly content that doubled organic website traffic."],
    },
  ],
  edu: { school: "University of Illinois", degree: "B.S. in Marketing", location: "Urbana, IL", startDate: "2012-08", endDate: "2016-05", current: false },
  edus: [{ school: "University of Illinois", degree: "B.S. in Marketing", location: "Urbana, IL", startDate: "2012-08", endDate: "2016-05", current: false }],
};

const isBlank = (d: PreviewData) =>
  !d.name.trim() && !d.email.trim() && !d.phone.trim() && !d.address.trim() && !d.jobTitle.trim() && !d.objective.trim() &&
  d.skills.length === 0 && !d.photo && !(d.languages ?? []).length && !(d.links ?? []).length && !(d.certifications ?? []).length &&
  !(d.projects ?? []).length && !(d.internships ?? []).length && !(d.interests ?? []).length &&
  !(d.jobs ?? [d.job]).some((j) => j.company.trim() || j.title.trim() || j.description.trim() || (j.bullets ?? []).length) &&
  !(d.edus ?? [d.edu]).some((e) => e.school.trim() || e.degree.trim());

/** Font size (cqw) for a name so it stays on its line: `width` is the room in cqw, `em` the average letter width. */
const fitName = (base: number, text: string, width: number, em: number) =>
  Math.max(base * 0.4, Math.min(base, width / (Math.max(1, text.length) * em)));

export default function LivePreview({
  d: given,
  template,
  active,
  sample = false,
  enter = false,
  inline = false,
  large = false,
  bare = false,
  onCustomize,
  overlay,
}: {
  d: PreviewData;
  template: string;
  active: PreviewSection;
  /** Show the sample person (John Doe) while nothing is written. Only used when judging the look in Customize. */
  sample?: boolean;
  /** Play the slide-in entrance (used when the wizard opens or the page is reloaded). */
  enter?: boolean;
  /** Draw the sheet where it is (for example inside a window) instead of pinning it to the side of the screen. */
  inline?: boolean;
  /** With `inline`: use the whole width available (the sheet may be taller than the screen, so it scrolls) instead of fitting the screen height. */
  large?: boolean;
  /** Only the sheet: no caption above or below it. */
  bare?: boolean;
  /** When given, a round palette button appears over the sheet on hover and calls this (opens "Customize"). */
  onCustomize?: () => void;
  /** Something drawn over the bottom of the sheet (the color picker), above it in z but not taking room from anything. */
  overlay?: React.ReactNode;
}) {
  const { tr, locale } = useT();
  SHEET_LANG = asResumeLang(locale);
  SHEET_PHOTO = photoShapeOf(template);
  // Nothing written yet: show the sample person so the look can be judged. Writing anything replaces it.
  const d = sample && isBlank(given) ? SAMPLE : given;
  // On desktop the sheet is pinned to the screen: the grid cell only reserves the space, the sheet itself is fixed over it
  const cell = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  // measured before the first paint, so the sheet never shows up in the wrong place and then jumps
  useLayoutEffect(() => {
    const el = cell.current;
    if (!el) return;
    const measure = () => {
      if (inline || window.innerWidth < 1024) return setBox(null);
      const r = el.getBoundingClientRect();
      const byHeight = Math.max(320, (window.innerHeight - 128) * 0.7071);
      const width = Math.min(r.width, byHeight);
      setBox({ left: r.left + (r.width - width) / 2, width });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [inline]);

  // Content is zoomed to the largest size that still fits on the sheet: smaller when there is a lot, a bit bigger when there is little.
  // Classic is one column, so the whole page scales together. Modern and Creative have two columns of very
  // different length, so each column gets its own scale: the long sidebar must not make the main column tiny.
  const paper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null); // the header of Modern and Creative, which is zoomed with the columns
  const [divH, setDivH] = useState<string | null>(null); // the height of the vertical line of Modern
  const [scale, setScale] = useState(1);
  // little content keeps the natural size of the text, unless the person chose to fill the page
  const growTo = !d.fillPage || FORM_TEMPLATES.includes(template) ? 1 : template === "blossom" ? MAX_GROW_BLOSSOM : MAX_GROW;
  const [colScale, setColScale] = useState({ l: 1, r: 1 });
  const fit = useCallback(() => {
    const p = paper.current;
    const c = content.current;
    if (!p || !c) return;
    const pr = p.getBoundingClientRect();
    // everything always goes on ONE sheet: the content is zoomed to the largest size that fits it
    const pageH = pr.height;
    const floor = SCALES[SCALES.length - 1];
    // the largest zoom that still fits (height only grows with zoom, so a binary search finds it in a few steps)
    const pick = (el: HTMLElement | null, limit: number) => {
      if (!el) return 1;
      const fits = (sc: number) => {
        el.style.zoom = String(sc);
        return el.getBoundingClientRect().height <= limit;
      };
      let lo = floor;
      let hi = growTo;
      if (fits(hi)) return hi;
      if (!fits(lo)) return lo;
      for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      el.style.zoom = String(lo);
      return Math.round(lo * 1000) / 1000;
    };
    if (colsRef.current && leftRef.current && rightRef.current) {
      c.style.zoom = "1";
      setScale(1);
      // one size for both columns, like the PDF: the default (1) when there is little content, smaller only when there is a lot.
      // The header (name, role) is zoomed with them, so it is taken into account: the size is found, the header is zoomed to it, and
      // the size is found again with the space the header really takes.
      const run = () => {
        // the PDF breaks the page 30pt above its bottom edge: that is as far as the columns may go
        const avail = pageH * (1 - 30 / 841.89) - (colsRef.current!.getBoundingClientRect().top - pr.top);
        return Math.min(pick(leftRef.current, avail), pick(rightRef.current, avail));
      };
      let common = run();
      if (headRef.current) {
        headRef.current.style.zoom = String(common);
        common = run();
        headRef.current.style.zoom = String(common);
      }
      // the same size in both columns and in the header, as the PDF (the search above leaves each column at its own best size)
      leftRef.current.style.zoom = String(common);
      rightRef.current.style.zoom = String(common);
      setColScale({ l: common, r: common });
    } else {
      setColScale({ l: 1, r: 1 });
      const best = pick(c, pageH * 0.98);
      setScale(best);
    }
  }, [growTo]);
  // re-fit whenever what is shown changes
  const signature = JSON.stringify(d) + template;
  useLayoutEffect(() => {
    fit();
  }, [signature, fit]);
  useLayoutEffect(() => {
    if (template !== "modern") return;
    const p = paper.current;
    const g = colsRef.current;
    if (!p || !g) return;
    const pr = p.getBoundingClientRect();
    const gr = g.getBoundingClientRect();
    const top = gr.top - (16 / 5.95) * (pr.width / 100) * colScale.l; // the line starts at the rule, 16pt (zoomed) above the columns
    const bottom = pr.top + pr.height * (1 - 40 / 841.89); // and ends 40pt above the bottom of the page, as in the PDF
    setDivH(`${Math.max(0, bottom - top)}px`);
  }, [colScale, signature, template]);
  useEffect(() => {
    const p = paper.current;
    if (!p) return;
    const ro = new ResizeObserver(fit);
    ro.observe(p);
    return () => ro.disconnect();
  }, [fit]);

  // The wizard's content animates in, and an animated ancestor traps position:fixed, so the pinned sheet is rendered on <body>
  const portalIfFixed = (node: React.ReactElement) => (box ? createPortal(node, document.body) : node);

  const jobsList = (d.jobs ?? [d.job]).filter((j) => j.title || j.company);
  const jobHas = jobsList.length > 0;
  const langs = (d.languages ?? []).filter((l) => l.name);
  const eduList = (d.edus ?? [d.edu]).filter((e) => e.school);
  const eduHas = eduList.length > 0;
  const honorsLine = (e: PreviewEdu) => [e.gpa ? `GPA: ${e.gpa}` : "", e.honors ?? ""].filter(Boolean).join("  |  ");
  const name = d.name.trim();

  /* ---------- shared bodies ---------- */
  const profileBody =
    d.objective.trim() ? <p style={{ ...f(1.85), lineHeight: 1.5, color: "#444" }}>{d.objective}</p> : <Bars widths={["100%", "96%", "70%"]} />;

  const academic = template === "academic";
  /** The academic look puts the years in a column at the left of every entry. */
  const withYears = (when: string, key: number, node: React.ReactNode) => (
    <div key={key} style={{ display: "grid", gridTemplateColumns: "16% 1fr", columnGap: "2.4cqw", marginTop: key ? "2.4cqw" : 0 }}>
      <p style={{ ...f(1.6), fontStyle: "italic", color: "#777" }}>{when}</p>
      <div style={{ minWidth: 0 }}>{node}</div>
    </div>
  );
  const renderJobs = (list: PreviewJob[]) => (
    <div>
      {list.map((j, ji) => academic ? withYears(period(j.startDate, j.endDate, j.current), ji, (
        <>
          <p style={{ ...f(2), fontWeight: 700 }}>{[j.title, j.company].filter(Boolean).join(", ")}</p>
          {j.location && <p style={{ ...f(1.6), color: "#777", fontStyle: "italic" }}>{j.location}</p>}
          {j.description && <p style={{ ...f(1.8), lineHeight: 1.5, color: "#444", marginTop: "0.8cqw" }}>{tr(j.description)}</p>}
          {(j.bullets ?? []).map((b, i) => (
            <p key={i} style={{ ...f(1.75), lineHeight: 1.45, color: "#444", marginTop: "0.6cqw", paddingLeft: "2.2cqw", textIndent: "-1.5cqw" }}>• {b}</p>
          ))}
        </>
      )) : (
        <div key={ji} style={{ marginTop: ji ? "2.4cqw" : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "2cqw" }}>
            <p style={{ ...f(2), fontWeight: 700 }}>{[j.title, j.company].filter(Boolean).join(", ")}</p>
            {j.location && <p style={{ ...f(1.6), color: "#777", flexShrink: 0 }}>{j.location}</p>}
          </div>
          {period(j.startDate, j.endDate, j.current) && (
            <p style={{ ...f(1.7), color: "#777", marginTop: "0.3cqw" }}>{period(j.startDate, j.endDate, j.current)}</p>
          )}
          {j.description && <p style={{ ...f(1.8), lineHeight: 1.5, color: "#444", marginTop: "0.8cqw" }}>{tr(j.description)}</p>}
          {(j.bullets ?? []).map((b, i) => (
            <p key={i} style={{ ...f(1.75), lineHeight: 1.45, color: "#444", marginTop: "0.6cqw", paddingLeft: "2.2cqw", textIndent: "-1.5cqw" }}>
              • {b}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
  const jobBody = jobHas ? renderJobs(jobsList) : <Bars widths={["60%", "35%", "92%", "80%"]} />;

  const linksList = (d.links ?? []).filter((l) => l.url?.trim());
  const certList = (d.certifications ?? []).filter((c) => c.name?.trim());
  const interestList = (d.interests ?? []).map((x) => x.trim()).filter(Boolean);
  const projectList = (d.projects ?? []).filter((x) => x.name?.trim());
  const internList = (d.internships ?? []).filter((j) => j.title || j.company);
  // The person can move the sections: the order they chose decides where each one goes (default order until they move one)
  const sectionPos = (ids: string[]) => {
    const o = orderedSections(d.sectionOrder, ids);
    return (id: string) => o.indexOf(id);
  };
  const projectsBody = (
    <div>
      {projectList.map((x, xi) => academic ? withYears(period(x.startDate ?? "", x.endDate ?? "", Boolean(x.current)), xi, (
        <>
          <p style={{ ...f(2), fontWeight: 700 }}>{x.name}</p>
          {x.description && <p style={{ ...f(1.8), lineHeight: 1.45, color: "#444", marginTop: "0.2cqw" }}>{tr(x.description)}</p>}
          {x.bullets.map((b, i) => (
            <p key={i} style={{ ...f(1.75), lineHeight: 1.45, color: "#444", marginTop: "0.6cqw", paddingLeft: "2.2cqw", textIndent: "-1.5cqw" }}>• {b}</p>
          ))}
        </>
      )) : (
        <div key={xi} style={{ marginTop: xi ? "2.4cqw" : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "2cqw" }}>
            <p style={{ ...f(2), fontWeight: 700 }}>{x.name}</p>
            {period(x.startDate ?? "", x.endDate ?? "", Boolean(x.current)) && (
              <p style={{ ...f(1.7), color: "#777", flexShrink: 0 }}>{period(x.startDate ?? "", x.endDate ?? "", Boolean(x.current))}</p>
            )}
          </div>
          {x.description && <p style={{ ...f(1.8), lineHeight: 1.45, color: "#444", marginTop: "0.2cqw" }}>{tr(x.description)}</p>}
          {x.link && <p style={{ ...f(1.6), color: "#777", marginTop: "0.3cqw" }}>{displayUrl(x.link)}</p>}
          {x.bullets.map((b, i) => (
            <p key={i} style={{ ...f(1.75), lineHeight: 1.45, color: "#444", marginTop: "0.6cqw", paddingLeft: "2.2cqw", textIndent: "-1.5cqw" }}>
              • {b}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
  const certsBody = (
    <div>
      {certList.map((c, ci) => (
        <div key={ci} style={{ display: "flex", justifyContent: "space-between", gap: "2cqw", marginTop: ci ? "1cqw" : 0, ...f(1.8) }}>
          <span>
            <b>{c.name}</b>
            {c.issuer ? `, ${c.issuer}` : ""}
          </span>
          {c.year && <span style={{ ...f(1.6), color: "#777" }}>{c.year}</span>}
        </div>
      ))}
    </div>
  );

  const eduBody = eduHas ? (
    <div>
      {eduList.map((e, ei) => academic ? withYears(period(e.startDate, e.endDate, e.current), ei, (
        <>
          <p style={{ ...f(2), fontWeight: 700 }}>{[e.degree, e.school].filter(Boolean).join(", ")}</p>
          {e.location && <p style={{ ...f(1.6), color: "#777", fontStyle: "italic" }}>{e.location}</p>}
          {honorsLine(e) && <p style={{ ...f(1.7), color: "#444", marginTop: "0.5cqw" }}>{honorsLine(e)}</p>}
          {e.coursework && <p style={{ ...f(1.65), lineHeight: 1.4, color: "#444", marginTop: "0.5cqw" }}>{tr("Coursework:")}{" "}{e.coursework}</p>}
        </>
      )) : (
        <div key={ei} style={{ marginTop: ei ? "2cqw" : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "2cqw" }}>
            <p style={{ ...f(2), fontWeight: 700 }}>{[e.degree, e.school].filter(Boolean).join(", ")}</p>
            {e.location && <p style={{ ...f(1.6), color: "#777", flexShrink: 0 }}>{e.location}</p>}
          </div>
          {period(e.startDate, e.endDate, e.current) && (
            <p style={{ ...f(1.7), color: "#777", marginTop: "0.3cqw" }}>{period(e.startDate, e.endDate, e.current)}</p>
          )}
          {honorsLine(e) && <p style={{ ...f(1.7), color: "#444", marginTop: "0.5cqw" }}>{honorsLine(e)}</p>}
          {e.coursework && <p style={{ ...f(1.65), lineHeight: 1.4, color: "#444", marginTop: "0.5cqw" }}>{tr("Coursework:")}{" "}{e.coursework}</p>}
        </div>
      ))}
    </div>
  ) : (
    <Bars widths={["55%", "30%"]} />
  );

  // Modern's sidebar (Details, Skills) is a little bigger than the other looks' side columns
  const sb = template === "modern" ? 1.05 : 1;
  const label = (t: string, v: string) => (
    <div style={{ marginBottom: "1.6cqw" }}>
      <p style={{ ...f(1.5 * sb), fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{tr(t)}</p>
      {v ? <p style={{ ...f(1.8 * sb), color: "#444", wordBreak: "break-word" }}>{v}</p> : <Bars widths={["70%"]} />}
    </div>
  );

  const detailsBlock = (
    <div style={glow(active === "contact")}>
      {label("Address", d.address)}
      {label("Phone", formatContactPhone(d.phone, d.countryCode))}
      {label("Email", d.email)}
      {linksList.map((l, i) => (
        <React.Fragment key={i}>{label(l.label || "Link", labeledLink(l.label, l.url))}</React.Fragment>
      ))}
    </div>
  );

  /* ---------- CLASSIC: centered serif, gray section bands, dotted leaders ---------- */
  const classic = () => {
    const band = (t: string) => (
      <div style={{ background: "#f1f1f1", height: "3.3cqw", display: "flex", alignItems: "center", justifyContent: "center", margin: "2.4cqw 0 1.4cqw" }}>
        <span style={{ ...f(1.95), lineHeight: 1, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "0.22cqw solid #1a1a1a", paddingBottom: "0.25cqw" }}>
          {tr(t)}
        </span>
      </div>
    );
    const leader = (left: string, right: string) => (
      <div style={{ display: "flex", alignItems: "baseline", gap: "1cqw", ...f(2), fontWeight: 600 }}>
        <span>◆ {left}</span>
        <span style={{ flex: 1, borderBottom: "0.25cqw dotted #aaa", transform: "translateY(-0.4cqw)" }} />
        {right && <span style={{ ...f(1.7), fontWeight: 400, color: "#555" }}>{right}</span>}
      </div>
    );
    return (
      <div style={{ padding: "6cqw 7cqw", fontFamily: "'Times New Roman', Times, serif", fontVariantNumeric: "lining-nums" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "3cqw" }}>
          {d.photo && <Photo src={d.photo} size={11} />}
          <div style={{ textAlign: "center", flex: 1 }}>
            <p style={{ ...f(fitName(d.photo ? 3.2 : 3.7, name || "Your Name", d.photo ? 70 : 84, 0.78)), fontWeight: 700, lineHeight: 1.05, letterSpacing: "0.05em", textTransform: "uppercase", color: name ? "#1a1a1a" : "#cfcfcf", whiteSpace: "nowrap" }}>
              {name || tr("Your Name")}
            </p>
            {d.jobTitle ? (
              <p style={{ ...f(1.9), lineHeight: 1.15, fontWeight: 400, marginTop: "0.1cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p>
            ) : (
              <div style={active === "about" ? glow(true) : undefined}><Skel w="22%" center mt="0.7cqw" /></div>
            )}
            {d.address ? (
              <p style={{ ...f(1.7), lineHeight: 1.15, color: "#555", marginTop: "1cqw", ...(active === "contact" ? glow(true) : {}) }}>{d.address}</p>
            ) : (
              <div style={active === "contact" ? glow(true) : undefined}><Skel w="42%" center mt="1.1cqw" /></div>
            )}
            {linksList.length > 0 && (
              <p style={{ ...f(1.6), lineHeight: 1.15, color: "#555", marginTop: "0.5cqw" }}>{linksList.map((l) => displayUrl(l.url)).join("  ·  ")}</p>
            )}
          </div>
          {d.photo && <div style={{ width: "11cqw", flexShrink: 0 }} />}
        </div>
        {/* with only one of phone / email, it goes in the middle */}
        <div style={{ ...f(1.9), letterSpacing: "0.02em", fontWeight: 400, display: "flex", justifyContent: d.phone.trim() !== "" !== (d.email.trim() !== "") ? "center" : "space-between", margin: "1.8cqw 0 0", padding: "0.4cqw 0 0", ...glow(active === "contact") }}>
          {(d.phone.trim() || !d.email.trim()) && <span>{formatContactPhone(d.phone, d.countryCode) || <span style={{ color: "#cfcfcf", fontWeight: 400 }}>(555) 123-4567</span>}</span>}
          {(d.email.trim() || !d.phone.trim()) && <span>{d.email || <span style={{ color: "#cfcfcf", fontWeight: 400 }}>{tr("you@email.com")}</span>}</span>}
        </div>
        {/* double rule under the contact row: the upper line is a little heavier */}
        <div style={{ marginTop: "0.7cqw", borderTop: "0.42cqw solid #1a1a1a", paddingTop: "0.4cqw" }}>
          <div style={{ borderTop: "0.1cqw solid #1a1a1a" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
        {/* the sections can be moved: CSS order puts each one where the person wants it */}
        {(() => {
          const pos = sectionPos(["about", "job", "education", "skills", "extras"]);
          return (
            <>
              <div style={{ order: pos("about") }}>
        {band("Profile")}
        <div style={{ textAlign: "center", ...glow(active === "about") }}>{profileBody}</div>

              </div>
              <div style={{ order: pos("job") }}>
        {band("Employment History")}
        <div style={glow(active === "job")}>
          {jobHas ? (
            <>
              {jobsList.map((j, ji) => (
                <div key={ji} style={{ position: "relative", marginTop: ji ? "2cqw" : 0 }}>
                  {leader([j.title, j.company].filter(Boolean).join(", "), period(j.startDate, j.endDate, j.current))}
                  {/* out of the flow: it sits beside the first line of text and never moves anything */}
                  {j.location && <p style={{ ...f(1.5), color: "#777", position: "absolute", right: 0, top: "3.4cqw", lineHeight: 1.2 }}>{j.location}</p>}
                  {j.description && <p style={{ ...f(1.8), lineHeight: 1.5, color: "#444", margin: "1cqw 0 0 2.4cqw", paddingRight: placeRoom(j.location) }}>• {tr(j.description)}</p>}
                  {(j.bullets ?? []).map((b, i) => (
                    <p key={i} style={{ ...f(1.75), lineHeight: 1.4, color: "#222", margin: "0.7cqw 0 0 3.2cqw", textIndent: "-1.5cqw", paddingRight: i === 0 && !j.description ? placeRoom(j.location) : undefined }}>
                      • {b}
                    </p>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <Bars widths={["60%", "88%", "75%"]} />
          )}
        </div>

              </div>
              <div style={{ order: pos("education") }}>
        {band("Education")}
        <div style={glow(active === "education")}>
          {eduHas ? (
            eduList.map((e, ei) => (
              <div key={ei} style={{ position: "relative", marginTop: ei ? "2cqw" : 0 }}>
                {leader(e.school, period(e.startDate, e.endDate, e.current))}
                {e.location && <p style={{ ...f(1.5), color: "#777", position: "absolute", right: 0, top: "3.4cqw", lineHeight: 1.2 }}>{e.location}</p>}
                {e.degree && <p style={{ ...f(1.7), fontStyle: "italic", color: "#444", margin: "0.7cqw 0 0 2.4cqw", paddingRight: placeRoom(e.location) }}>{e.degree}</p>}
                {honorsLine(e) && <p style={{ ...f(1.65), color: "#333", margin: "0.5cqw 0 0 2.4cqw" }}>{honorsLine(e)}</p>}
                {e.coursework && <p style={{ ...f(1.6), lineHeight: 1.4, color: "#444", margin: "0.5cqw 0 0 2.4cqw" }}>{tr("Coursework:")}{" "}{e.coursework}</p>}
              </div>
            ))
          ) : (
            <Bars widths={["55%"]} />
          )}
        </div>

              </div>
              <div style={{ order: pos("skills") }}>
        {band("Skills")}
        <div style={{ ...glow(active === "skills"), display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "4cqw", rowGap: "1cqw" }}>
          {d.skills.length > 0 ? (
            d.skills.map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "baseline", gap: "1cqw", ...f(1.9) }}>
                <span>{s}</span>
                <span style={{ flex: 1, borderBottom: "0.25cqw dotted #aaa" }} />
                {skillLevel(d.skillLevels, s) > 0 && (
                  <StarRow level={skillLevel(d.skillLevels, s)} />
                )}
              </div>
            ))
          ) : (
            <>
              <Bars widths={["80%"]} />
              <Bars widths={["80%"]} />
            </>
          )}
        </div>

        {langs.length > 0 && (
          <>
            {band("Languages")}
            <div style={{ ...glow(active === "skills"), display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "4cqw", rowGap: "1cqw" }}>
              {langs.map((l) => (
                <div key={l.name} style={{ display: "flex", alignItems: "baseline", gap: "1cqw", ...f(1.9) }}>
                  <span>{l.name}</span>
                  <span style={{ flex: 1, borderBottom: "0.25cqw dotted #aaa" }} />
                  <span style={{ fontStyle: "italic", fontWeight: 700, ...f(1.7) }}>{levelText(l.level)}</span>
                </div>
              ))}
            </div>
          </>
        )}

              </div>
              <div style={{ order: pos("extras") }}>
        {projectList.length > 0 && (
          <>
            {band("Projects")}
            {projectList.map((x, xi) => (
              <div key={xi} style={{ marginTop: xi ? "2cqw" : 0 }}>
                {leader(x.name, period(x.startDate ?? "", x.endDate ?? "", Boolean(x.current)))}
                {x.description && <p style={{ ...f(1.8), lineHeight: 1.4, color: "#444", margin: "0.2cqw 0 0 2.4cqw" }}>{tr(x.description)}</p>}
                {x.bullets.map((b, i) => (
                  <p key={i} style={{ ...f(1.75), lineHeight: 1.4, color: "#222", margin: "0.7cqw 0 0 3.2cqw", textIndent: "-1.5cqw" }}>
                    • {b}
                  </p>
                ))}
              </div>
            ))}
          </>
        )}
        {internList.length > 0 && (
          <>
            {band("Internships")}
            {renderJobs(internList)}
          </>
        )}
        {certList.length > 0 && (
          <>
            {band("Certifications")}
            {certsBody}
          </>
        )}
        {interestList.length > 0 && (
          <>
            {band("Interests")}
            <p style={{ ...f(1.7), lineHeight: 1.55 }}>{interestList.join("  ·  ")}</p>
          </>
        )}

              </div>
            </>
          );
        })()}
        </div>
      </div>
    );
  };

  /* ---------- SIDEBAR: a dark column (photo, contact, skills, languages) and the story at the right ---------- */
  const sidebar = () => {
    const SOFT = "var(--acc-light)";
    const WHITE = "#eef3fa";
    const side = (t: string) => (
      <p style={{ ...f(1.5), fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: SOFT, borderBottom: "0.15cqw solid var(--acc-mid)", paddingBottom: "0.8cqw", margin: "3.4cqw 0 1.6cqw" }}>{tr(t)}</p>
    );
    const head = (t: string) => (
      <div style={{ margin: "0 0 1.8cqw" }}>
        <p style={{ ...f(2), fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "1.4cqw" }}>
          <span style={{ width: "0.7cqw", height: "2.2cqw", background: "var(--acc)", flexShrink: 0 }} />
          {tr(t)}
        </p>
        <div style={{ borderTop: "0.15cqw solid #dfe5ee", marginTop: "0.8cqw" }} />
      </div>
    );
    const phone = formatContactPhone(d.phone, d.countryCode);
    const items: { icon: React.ReactNode; text: string }[] = [
      { icon: <Home size="100%" strokeWidth={2.2} />, text: d.address },
      { icon: <Smartphone size="100%" strokeWidth={2.2} />, text: phone },
      { icon: <Mail size="100%" strokeWidth={2.2} />, text: d.email },
      ...linksList.map((l) => {
        const t = `${l.url} ${l.label ?? ""}`.toLowerCase();
        return { icon: t.includes("linkedin") ? <Linkedin size="100%" strokeWidth={2.2} /> : t.includes("github") ? <Github size="100%" strokeWidth={2.2} /> : <Globe size="100%" strokeWidth={2.2} />, text: shortContactLink(l.url) };
      }),
    ].filter((i) => i.text);
    const groups = groupSkills(d.skills, d.skillGroups);
    const grouped = hasSkillGroups(d.skills, d.skillGroups);
    const lightDots = (n: number) => (
      <span style={{ display: "inline-flex", gap: "0.6cqw" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} style={{ width: "1cqw", height: "1cqw", borderRadius: "50%", boxSizing: "border-box", border: `0.2cqw solid ${i <= n ? WHITE : SOFT}`, background: i <= n ? WHITE : "transparent" }} />
        ))}
      </span>
    );
    const pos = sectionPos(["about", "job", "education", "extras"]);
    return (
      <div style={{ position: "relative", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <div ref={colsRef} style={{ display: "grid", gridTemplateColumns: "32% 1fr", alignItems: "start", minHeight: "100%" }}>
          <div ref={leftRef} style={{ zoom: colScale.l, padding: "6cqw 3.6cqw 4cqw 4.4cqw", color: WHITE }}>
            {d.photo && <div style={{ display: "flex", justifyContent: "center", marginBottom: "3cqw" }}><Photo src={d.photo} size={17} /></div>}
            <div style={glow(active === "contact")}>
              {side("Contact")}
              {items.length ? (
                items.map((it, i) => (
                  <div key={i} style={{ display: "flex", gap: "1.4cqw", alignItems: "flex-start", marginBottom: "1.2cqw", ...f(1.55), lineHeight: 1.35, wordBreak: "break-word" }}>
                    <span style={{ display: "inline-flex", width: "1.7cqw", height: "1.7cqw", flexShrink: 0, color: SOFT, marginTop: "0.1cqw" }}>{it.icon}</span>
                    {it.text}
                  </div>
                ))
              ) : (
                <p style={{ ...f(1.55), color: SOFT }}>{tr("you@email.com")}</p>
              )}
            </div>
            <div style={glow(active === "skills")}>
              {side("Skills")}
              {d.skills.length === 0 ? (
                <Bars widths={["80%", "60%"]} />
              ) : (
                groups.map((g, gi) => (
                  <div key={gi} style={{ marginBottom: grouped ? "1.8cqw" : 0 }}>
                    {grouped && <p style={{ ...f(1.2), fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SOFT, marginBottom: "0.6cqw" }}>{g.label || tr("Other")}</p>}
                    {g.skills.map((sk) => (
                      <div key={sk} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.2cqw", marginBottom: "0.9cqw", ...f(1.7) }}>
                        <span>{sk}</span>
                        {skillLevel(d.skillLevels, sk) > 0 && lightDots(skillLevel(d.skillLevels, sk))}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
            {langs.length > 0 && (
              <>
                {side("Languages")}
                {langs.map((l, i) => (
                  <div key={i} style={{ marginBottom: "1cqw", ...f(1.7) }}>
                    {l.name}
                    {l.level && <p style={{ ...f(1.4), color: SOFT }}>{levelText(l.level)}</p>}
                  </div>
                ))}
              </>
            )}
          </div>
          <div ref={rightRef} style={{ zoom: colScale.r, padding: "6cqw 6cqw 4cqw 5cqw", display: "flex", flexDirection: "column" }}>
            <p style={{ ...f(fitName(4.4, name || "Your Name", 52, 0.7)), fontWeight: 700, lineHeight: 1.1, color: name ? "#1a1a1a" : "#cfcfcf", whiteSpace: "nowrap" }}>{name || tr("Your Name")}</p>
            {d.jobTitle ? <p style={{ ...f(2.2), color: "var(--acc)", marginTop: "1cqw", marginBottom: "3.6cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p> : <div style={{ marginBottom: "3.6cqw", ...(active === "about" ? glow(true) : {}) }}><Skel w="30%" mt="1.2cqw" /></div>}
            <div style={{ order: pos("about"), marginBottom: "3cqw" }}>
              {head("Profile")}
              <div style={glow(active === "about")}>{profileBody}</div>
            </div>
            <div style={{ order: pos("job"), marginBottom: "3cqw" }}>
              {head("Employment History")}
              <div style={glow(active === "job")}>{jobBody}</div>
            </div>
            <div style={{ order: pos("education"), marginBottom: "3cqw" }}>
              {head("Education")}
              <div style={glow(active === "education")}>{eduBody}</div>
            </div>
            <div style={{ order: pos("extras") }}>
              {projectList.length > 0 && (
                <div style={{ marginBottom: "3cqw" }}>
                  {head("Projects")}
                  {projectsBody}
                </div>
              )}
              {internList.length > 0 && (
                <div style={{ marginBottom: "3cqw" }}>
                  {head("Internships")}
                  {renderJobs(internList)}
                </div>
              )}
              {certList.length > 0 && (
                <div>
                  {head("Certifications")}
                  {certsBody}
                </div>
              )}
              {interestList.length > 0 && (
                <div style={{ marginTop: "2.4cqw" }}>
                  {head("Interests")}
                  <p style={{ ...f(1.7), lineHeight: 1.55 }}>{interestList.join("  ·  ")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ---------- PURE ATS: nothing but text ---------- */
  const ats = () => {
    const phone = formatContactPhone(d.phone, d.countryCode);
    const contact = [d.address, phone, d.email, ...linksList.map((l) => displayUrl(l.url))].filter(Boolean);
    const pos = sectionPos(["about", "job", "education", "skills", "extras"]);
    const h = (t: string) => <p style={{ ...f(1.85), fontWeight: 700, textTransform: "uppercase", margin: "2.6cqw 0 0.8cqw", color: "#000" }}>{tr(t)}</p>;
    const line = { ...f(1.6), lineHeight: 1.45, color: "#000" } as React.CSSProperties;
    const entry = (title: string, rest: string, bullets: string[], description = "") => (
      <div style={{ marginBottom: "1.6cqw" }}>
        <p style={{ ...line, fontWeight: 700 }}>{title}</p>
        {rest && <p style={line}>{rest}</p>}
        {description && <p style={line}>{tr(description)}</p>}
        {bullets.map((b, i) => <p key={i} style={{ ...line, paddingLeft: "2cqw", textIndent: "-1.5cqw" }}>- {b}</p>)}
      </div>
    );
    const groups = groupSkills(d.skills, d.skillGroups);
    const grouped = hasSkillGroups(d.skills, d.skillGroups);
    return (
      <div style={{ fontFamily: "Helvetica, Arial, sans-serif", color: "#000", padding: "7cqw 8cqw 6cqw", display: "flex", flexDirection: "column" }}>
        <p style={{ ...f(3.4), fontWeight: 700, color: name ? "#000" : "#bbb" }}>{name || tr("Your Name")}</p>
        {d.jobTitle && <p style={{ ...f(1.9), marginTop: "0.6cqw" }}>{d.jobTitle}</p>}
        <p style={{ ...f(1.5), marginTop: "1cqw", ...glow(active === "contact") }}>{contact.length ? contact.join("  |  ") : tr("you@email.com")}</p>
        <div style={{ order: pos("about") }}>
          {h("Professional Summary")}
          <div style={glow(active === "about")}>{d.objective.trim() ? <p style={line}>{d.objective}</p> : <Bars widths={["100%", "92%", "60%"]} />}</div>
        </div>
        <div style={{ order: pos("job") }}>
          {h("Work Experience")}
          <div style={glow(active === "job")}>
            {jobHas ? jobsList.map((j, i) => <React.Fragment key={i}>{entry(j.title || j.company, [j.title ? j.company : "", j.location, period(j.startDate, j.endDate, j.current)].filter(Boolean).join(" | "), j.bullets ?? [], j.bullets?.length ? "" : j.description)}</React.Fragment>) : <Bars widths={["60%", "90%", "75%"]} />}
          </div>
        </div>
        <div style={{ order: pos("education") }}>
          {h("Education")}
          <div style={glow(active === "education")}>
            {eduHas ? eduList.map((e, i) => <React.Fragment key={i}>{entry(e.degree || e.school, [e.degree ? e.school : "", e.location, period(e.startDate, e.endDate, e.current)].filter(Boolean).join(" | "), [])}</React.Fragment>) : <Bars widths={["70%", "50%"]} />}
          </div>
        </div>
        <div style={{ order: pos("skills") }}>
          {h("Skills")}
          <div style={glow(active === "skills")}>
            {d.skills.length === 0 ? <Bars widths={["80%", "55%"]} /> : groups.map((g, i) => <p key={i} style={line}>{g.label || grouped ? `${g.label || tr("Other")}: ` : ""}{g.skills.join(", ")}</p>)}
          </div>
          {langs.length > 0 && (
            <>
              {h("Languages")}
              <p style={line}>{langs.map((l) => (l.level ? `${l.name} (${levelText(l.level)})` : l.name)).join(", ")}</p>
            </>
          )}
        </div>
        <div style={{ order: pos("extras") }}>
          {projectList.length > 0 && (
            <>
              {h("Projects")}
              {projectList.map((x, i) => <React.Fragment key={i}>{entry(x.name, period(x.startDate ?? "", x.endDate ?? "", Boolean(x.current)), x.bullets, x.bullets.length ? "" : x.description ?? "")}</React.Fragment>)}
            </>
          )}
          {certList.length > 0 && (
            <>
              {h("Certifications")}
              {certList.map((c, i) => <p key={i} style={line}>{[c.name, c.issuer, c.year].filter(Boolean).join(" - ")}</p>)}
            </>
          )}
          {interestList.length > 0 && (
            <>
              {h("Interests")}
              <p style={{ ...f(1.7), lineHeight: 1.55 }}>{interestList.join("  ·  ")}</p>
            </>
          )}
        </div>
      </div>
    );
  };

  /** The label of a form box. */
  const jl = (key: string) => tr(key);

  /* ---------- SHOKUMU: a Japanese career history, one ruled table per job ---------- */
  const shokumu = () => {
    const phone = formatContactPhone(d.phone, d.countryCode);
    const contact = [d.address, phone, d.email, ...linksList.map((l) => displayUrl(l.url))].filter(Boolean);
    const pos = sectionPos(["about", "job", "education", "skills", "extras"]);
    const LINE = "0.15cqw solid #8f98a3";
    const text = { ...f(1.45), lineHeight: 1.4, color: "#1a1a1a" } as React.CSSProperties;
    const title = (t: string) => (
      <p style={{ ...f(1.9), fontWeight: 700, margin: "2.6cqw 0 1cqw", borderLeft: "0.8cqw solid var(--acc)", paddingLeft: "1.6cqw", lineHeight: 1.1 }}>{tr(t)}</p>
    );
    const head = (left: string, right: string) => (
      <div style={{ display: "flex", justifyContent: "space-between", gap: "2cqw", background: "var(--acc-soft)", border: LINE, padding: "0.9cqw 1.6cqw", ...f(1.55), fontWeight: 700 }}>
        <span>{left}</span>
        <span style={{ fontWeight: 400, flexShrink: 0 }}>{right}</span>
      </div>
    );
    const row = (label: string, lines: string[], bullet = false) => (
      <div style={{ display: "grid", gridTemplateColumns: "16% 1fr", border: LINE, borderTop: "none" }}>
        <div style={{ background: "var(--acc-soft)", borderRight: LINE, padding: "0.9cqw 1.4cqw", ...f(1.3), fontWeight: 700 }}>{tr(label)}</div>
        <div style={{ padding: "0.9cqw 1.6cqw" }}>
          {lines.filter(Boolean).map((l, i) => <p key={i} style={{ ...text, paddingLeft: bullet ? "1.8cqw" : 0, textIndent: bullet ? "-1.4cqw" : 0 }}>{bullet ? "• " : ""}{l}</p>)}
        </div>
      </div>
    );
    const groups = groupSkills(d.skills, d.skillGroups);
    const grouped = hasSkillGroups(d.skills, d.skillGroups);
    return (
      <div style={{ fontFamily: "Helvetica, Arial, sans-serif", padding: "6cqw 6cqw 5cqw", display: "flex", flexDirection: "column" }}>
        <p style={{ ...f(3), fontWeight: 700, textAlign: "center", paddingBottom: "0.4cqw" }}>{tr("Career History")}</p>
        <p style={{ ...f(1.5), textAlign: "right", paddingBottom: "1cqw", marginBottom: "2cqw", borderBottom: "0.35cqw double #1a1a1a" }}><b>{name || tr("Your Name")}</b></p>
        <div style={{ ...glow(active === "contact") }}>
          <div style={{ display: "grid", gridTemplateColumns: "16% 1fr", border: LINE }}>
            <div style={{ background: "var(--acc-soft)", borderRight: LINE, padding: "0.9cqw 1.4cqw", ...f(1.3), fontWeight: 700 }}>{jl("Name")}</div>
            <div style={{ padding: "0.9cqw 1.6cqw", ...text }}>{name || tr("Your Name")}{d.jobTitle ? `  -  ${d.jobTitle}` : ""}</div>
          </div>
          {row("Contact", [contact.join("   /   ") || tr("you@email.com")])}
        </div>
        <div style={{ order: pos("about") }}>
          {title("Career summary")}
          <div style={glow(active === "about")}>{d.objective.trim() ? row("Overview", [d.objective]) : <Bars widths={["100%", "90%"]} />}</div>
        </div>
        <div style={{ order: pos("job") }}>
          {title("Work history")}
          <div style={glow(active === "job")}>
            {jobHas ? jobsList.map((j, i) => (
              <div key={i} style={{ marginBottom: "2cqw" }}>
                {head(j.company || j.title, period(j.startDate, j.endDate, j.current))}
                {j.company && j.title && row("Position", [j.title])}
                {j.location && row("Location", [j.location])}
                {(j.bullets?.length || j.description) && row("Duties", j.bullets?.length ? j.bullets : [j.description], Boolean(j.bullets?.length))}
              </div>
            )) : <Bars widths={["60%", "90%", "75%"]} />}
          </div>
        </div>
        <div style={{ order: pos("education") }}>
          {title("Education")}
          <div style={glow(active === "education")}>
            {eduHas ? eduList.map((e, i) => (
              <div key={i} style={{ marginBottom: "2cqw" }}>
                {head(e.school || e.degree, period(e.startDate, e.endDate, e.current))}
                {e.degree && row("Position", [e.degree])}
                {[honorsLine(e), e.coursework ?? "", e.location ?? ""].some(Boolean) && row("Duties", [honorsLine(e), e.coursework ?? "", e.location ?? ""])}
              </div>
            )) : <Bars widths={["70%", "50%"]} />}
          </div>
        </div>
        <div style={{ order: pos("skills") }}>
          {title("Skills")}
          <div style={glow(active === "skills")}>
            {d.skills.length === 0 ? <Bars widths={["80%", "55%"]} /> : (
              <>
                {groups.map((g, i) => <React.Fragment key={i}>{i === 0 ? <div style={{ borderTop: LINE }} /> : null}{row(g.label || (grouped ? tr("Other") : tr("Skills")), [g.skills.join(", ")])}</React.Fragment>)}
                {langs.length > 0 && row("Languages", [langs.map((l) => (l.level ? `${l.name} (${levelText(l.level)})` : l.name)).join(", ")])}
              </>
            )}
          </div>
        </div>
        <div style={{ order: pos("extras") }}>
          {projectList.length > 0 && (
            <>
              {title("Projects")}
              {projectList.map((x, i) => (
                <div key={i} style={{ marginBottom: "2cqw" }}>
                  {head(x.name, period(x.startDate ?? "", x.endDate ?? "", Boolean(x.current)))}
                  {(x.bullets.length > 0 || x.description) && row("Duties", x.bullets.length ? x.bullets : [x.description ?? ""], x.bullets.length > 0)}
                </div>
              ))}
            </>
          )}
          {certList.length > 0 && (
            <>
              {title("Certifications")}
              <div style={{ borderTop: LINE }} />
              {certList.map((c, i) => <React.Fragment key={i}>{row(c.year || "Date", [[c.name, c.issuer].filter(Boolean).join(" - ")])}</React.Fragment>)}
            </>
          )}
          {interestList.length > 0 && (
            <>
              {title("Interests")}
              <p style={{ ...f(1.7), lineHeight: 1.55 }}>{interestList.join("  ·  ")}</p>
            </>
          )}
        </div>
      </div>
    );
  };

  /* ---------- RIREKISHO: the Japanese resume form, a ruled grid ---------- */
  const rirekisho = () => {
    const phone = formatContactPhone(d.phone, d.countryCode);
    const B = "0.2cqw solid #222";
    const lab = { ...f(1.05), color: "#777", marginBottom: "0.3cqw" } as React.CSSProperties;
    const val = { ...f(1.55), color: "#1a1a1a" } as React.CSSProperties;
    const ym = (v: string): [string, string] => (/^\d{4}-\d{2}$/.test(v) ? [v.slice(0, 4), String(Number(v.slice(5)))] : ["", ""]);
    type Ln = { y?: string; m?: string; t?: string; sec?: string; right?: boolean };
    const lines: Ln[] = [];
    const eds = [...eduList].sort((a, b) => (a.startDate || a.endDate || "9999").localeCompare(b.startDate || b.endDate || "9999"));
    if (eds.length) {
      lines.push({ sec: "Education" });
      for (const e of eds) {
        const sch = e.school || e.degree;
        const [sy, sm] = ym(e.startDate);
        if (sy) lines.push({ y: sy, m: sm, t: `${sch}  -  ${tr("Entered")}` });
        const [ey, em] = ym(e.endDate);
        if (e.current) lines.push({ t: `${e.degree || sch}  -  ${tr("Current")}` });
        else if (ey) lines.push({ y: ey, m: em, t: `${e.degree ? e.degree + ", " : ""}${sch}  -  ${tr("Graduated")}` });
        else if (!sy) lines.push({ t: sch });
      }
    }
    const jobsAsc = [...jobsList].sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"));
    if (jobsAsc.length) {
      lines.push({ sec: "Work history" });
      for (const j of jobsAsc) {
        const co = j.company || j.title;
        const [sy, sm] = ym(j.startDate);
        lines.push({ y: sy, m: sm, t: `${co}  -  ${tr("Joined")}` });
        if (j.title && j.company) lines.push({ t: `   ${j.title}` });
        const [ey, em] = ym(j.endDate);
        if (j.current || !ey) lines.push({ t: `   ${tr("Current")}` });
        else lines.push({ y: ey, m: em, t: `${co}  -  ${tr("Left")}` });
      }
    }
    if (lines.length) lines.push({ t: tr("End of list"), right: true });
    const table = (head: React.ReactNode, rows: Ln[]) => (
      <div style={{ border: B, marginBottom: "2.4cqw" }}>
        <div style={{ display: "grid", gridTemplateColumns: "8% 6% 1fr", background: "#eee", ...f(1.35), fontWeight: 700, textAlign: "center" }}>
          <div style={{ padding: "0.6cqw 0" }}>{tr("Year")}</div>
          <div style={{ padding: "0.6cqw 0", borderLeft: B }}>{tr("Month")}</div>
          <div style={{ padding: "0.6cqw 0", borderLeft: B }}>{head}</div>
        </div>
        {rows.map((r, i) =>
          r.sec ? (
            <div key={i} style={{ borderTop: B, textAlign: "center", fontWeight: 700, ...f(1.5), padding: "0.7cqw 0" }}>{tr(r.sec)}</div>
          ) : (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "8% 6% 1fr", borderTop: B, ...f(1.5) }}>
              <div style={{ padding: "0.7cqw 0", textAlign: "center" }}>{r.y}</div>
              <div style={{ padding: "0.7cqw 0", textAlign: "center", borderLeft: B }}>{r.m}</div>
              <div style={{ padding: "0.7cqw 1.4cqw", borderLeft: B, textAlign: r.right ? "right" : "left" }}>
                {r.t}
              </div>
            </div>
          )
        )}
      </div>
    );
    return (
      <div style={{ fontFamily: "Helvetica, Arial, sans-serif", padding: "5.5cqw 5.5cqw 5cqw", color: "#1a1a1a" }}>
        <div style={{ display: "flex", gap: "2.4cqw", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.4cqw" }}>
              <p style={{ ...f(3.8), fontWeight: 700 }}>{tr("Resume")}</p>
            </div>
            <div style={{ border: B, padding: "0.8cqw 1.4cqw", ...glow(active === "contact") }}>
              <p style={lab}>{jl("Name")}</p>
              <p style={{ ...f(3.2), fontWeight: 700, color: name ? "#1a1a1a" : "#ccc" }}>{name || tr("Your Name")}</p>
            </div>
            <div style={{ border: B, borderTop: "none", padding: "0.8cqw 1.4cqw" }}>
              <p style={lab}>{jl("Address")}</p>
              <p style={val}>{d.address}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              <div style={{ border: B, borderTop: "none", padding: "0.8cqw 1.4cqw" }}>
                <p style={lab}>{jl("Phone")}</p>
                <p style={val}>{phone}</p>
              </div>
              <div style={{ border: B, borderTop: "none", borderLeft: "none", padding: "0.8cqw 1.4cqw" }}>
                <p style={lab}>{tr("Email")}</p>
                <p style={{ ...val, wordBreak: "break-all" }}>{d.email}</p>
              </div>
            </div>
          </div>
          <div style={{ width: "15cqw", aspectRatio: "3 / 4", border: B, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", ...f(1.2), color: "#999" }}>
            {d.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span>{tr("PHOTO")}</span>
            )}
          </div>
        </div>
        <div style={{ height: "2.4cqw" }} />
        {lines.length > 0 ? <div style={glow(active === "job" || active === "education")}>{table(jl("Education and work history"), lines)}</div> : <Bars widths={["80%", "60%", "70%"]} />}
        {certList.length > 0 && table(jl("Licenses and certifications"), certList.map((c) => ({ y: c.year, t: [c.name, c.issuer].filter(Boolean).join(" - ") })))}
        {(d.skills.length > 0 || langs.length > 0) && (
          <div style={{ border: B, padding: "0.8cqw 1.4cqw", marginBottom: "2.4cqw", ...glow(active === "skills") }}>
            <p style={lab}>{jl("Skills")}</p>
            <p style={val}>{d.skills.join(", ")}</p>
            {langs.length > 0 && <p style={val}>{tr("Languages")}: {langs.map((l) => (l.level ? `${l.name} (${levelText(l.level)})` : l.name)).join(", ")}</p>}
          </div>
        )}
        {d.objective.trim() && (
          <div style={{ border: B, padding: "0.8cqw 1.4cqw", ...glow(active === "about") }}>
            <p style={lab}>{jl("Summary")}</p>
            <p style={{ ...val, lineHeight: 1.5 }}>{d.objective}</p>
          </div>
        )}
      </div>
    );
  };

  /* ---------- ESSENTIAL: drawn like the PDF (a classic Word resume): centered name, icons, light and dark rules ---------- */
  const essential = () => {
    const pos = sectionPos(["about", "job", "education", "skills", "extras"]);
    const INK = "#2e3d50";
    const DARK = "#333f4f";
    const LIGHT = "#dae3f3";
    const font = "Calibri, Carlito, 'Segoe UI', Arial, sans-serif";
    const phone = formatContactPhone(d.phone, d.countryCode);
    const shownName = name || "Your Name";
    const contactItems: { icon: React.ReactNode; text: string }[] = [
      { icon: <Home size="100%" strokeWidth={2.2} />, text: d.address },
      { icon: <Mail size="100%" strokeWidth={2.2} />, text: d.email },
      { icon: <Smartphone size="100%" strokeWidth={2.2} />, text: phone },
      ...linksList.map((l) => {
        const t = `${l.url} ${l.label ?? ""}`.toLowerCase();
        return { icon: t.includes("linkedin") ? <Linkedin size="100%" strokeWidth={2.2} /> : t.includes("github") ? <Github size="100%" strokeWidth={2.2} /> : <Globe size="100%" strokeWidth={2.2} />, text: shortContactLink(l.url) };
      }),
    ].filter((i) => i.text);
    const sec = (t: string) => (
      <div style={{ margin: "1.35cqw 0 0.6cqw" }}>
        <p style={{ ...f(2.02), fontWeight: 700, textTransform: "uppercase", lineHeight: 1.22 }}>{tr(t)}</p>
        <div style={{ borderTop: `0.17cqw solid ${DARK}`, marginTop: "0.05cqw" }} />
      </div>
    );
    const end = () => <div style={{ borderTop: `0.17cqw solid ${LIGHT}`, marginTop: "0.8cqw", marginLeft: "-0.45cqw", marginRight: "-0.45cqw" }} />;
    const meta = (parts: (string | undefined)[]) => parts.filter(Boolean).join("  •  ");
    const bulletsOf = (list: string[]) =>
      list.map((b, i) => (
        <div key={i} style={{ display: "flex", ...f(1.345), lineHeight: 1.22, marginTop: "0.08cqw" }}>
          <span style={{ width: "3cqw", flexShrink: 0 }}>•</span>
          <span style={{ flex: 1 }}>{b}</span>
        </div>
      ));
    const entry = (title: string, company: string, right: string, bullets: string[], description = "") => (
      <div style={{ marginTop: "1cqw" }}>
        {company ? (
          <>
            <p style={{ ...f(1.6), fontWeight: 700, lineHeight: 1.22 }}>{title}</p>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "2cqw", ...f(1.345), fontWeight: 700, lineHeight: 1.22 }}>
              <span>{company}</span>
              <span style={{ flexShrink: 0 }}>{right}</span>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "2cqw", alignItems: "baseline" }}>
            <span style={{ ...f(1.6), fontWeight: 700, lineHeight: 1.22 }}>{title}</span>
            <span style={{ ...f(1.345), fontWeight: 700, flexShrink: 0 }}>{right}</span>
          </div>
        )}
        {description && <p style={{ ...f(1.345), lineHeight: 1.22 }}>{tr(description)}</p>}
        {bulletsOf(bullets)}
      </div>
    );

    const groups = groupSkills(d.skills, d.skillGroups);
    const grouped = hasSkillGroups(d.skills, d.skillGroups);
    const skillLines = groups.map((g) => (g.label || grouped ? `${g.label || tr("Other")}: ` : "") + g.skills.join(", "));
    const langLine = langs.map((l) => (l.level ? `${l.name} (${levelText(l.level)})` : l.name)).join(", ");

    const blocks: Record<string, React.ReactNode> = {
      about: (
        <div style={{ order: pos("about") }}>
          {sec("Summary")}
          <div style={glow(active === "about")}>{d.objective.trim() ? <p style={{ ...f(1.345), lineHeight: 1.22 }}>{d.objective}</p> : <Bars widths={["100%", "96%", "70%"]} />}</div>
          {end()}
        </div>
      ),
      job: (
        <div style={{ order: pos("job") }}>
          {sec("Experience")}
          <div style={glow(active === "job")}>
            {jobHas ? jobsList.map((j, i) => <React.Fragment key={i}>{entry(j.title, j.company, meta([period(j.startDate, j.endDate, j.current), j.location]), j.bullets ?? [], j.bullets?.length ? "" : j.description)}</React.Fragment>) : <Bars widths={["60%", "90%", "75%"]} />}
          </div>
          {end()}
        </div>
      ),
      education: (
        <div style={{ order: pos("education") }}>
          {sec("Education")}
          <div style={glow(active === "education")}>
            {eduHas ? (
              eduList.map((e, i) => (
                <div key={i} style={{ marginTop: i ? "0.6cqw" : "1cqw" }}>
                  <p style={{ ...f(1.6), fontWeight: 700, lineHeight: 1.22 }}>{e.degree || e.school}</p>
                  <p style={{ ...f(1.345), lineHeight: 1.22 }}>{meta([e.degree ? e.school : "", e.location, period(e.startDate, e.endDate, e.current)])}</p>
                  {honorsLine(e) && <p style={{ ...f(1.345), lineHeight: 1.22 }}>{honorsLine(e)}</p>}
                  {e.coursework && <p style={{ ...f(1.345), lineHeight: 1.22 }}>{tr("Coursework:")}{" "}{e.coursework}</p>}
                </div>
              ))
            ) : (
              <Bars widths={["70%", "50%"]} />
            )}
          </div>
          {end()}
        </div>
      ),
      skills: (
        <div style={{ order: pos("skills") }}>
          {sec(d.skills.length || !langs.length ? "Skills" : "Languages")}
          <div style={{ ...glow(active === "skills"), marginTop: "0.9cqw" }}>
            {d.skills.length === 0 && langs.length === 0 ? (
              <Bars widths={["80%", "55%"]} />
            ) : (
              <>
                {skillLines.map((line, i) => (
                  <p key={i} style={{ ...f(1.345), lineHeight: 1.22, marginBottom: "0.35cqw" }}>{line}</p>
                ))}
                {langs.length > 0 && <p style={{ ...f(1.345), lineHeight: 1.22 }}>{d.skills.length ? `${tr("Languages")}: ${langLine}` : langLine}</p>}
              </>
            )}
          </div>
          {end()}
        </div>
      ),
      extras: (
        <div style={{ order: pos("extras") }}>
          {projectList.length > 0 && (
            <>
              {sec("Projects")}
              {projectList.map((x, i) => (
                <React.Fragment key={i}>{entry(x.name, "", meta([x.link ? displayUrl(x.link) : "", period(x.startDate ?? "", x.endDate ?? "", Boolean(x.current))]), x.bullets, x.bullets.length ? "" : x.description ?? "")}</React.Fragment>
              ))}
              {end()}
            </>
          )}
          {internList.length > 0 && (
            <>
              {sec("Internships")}
              {internList.map((j, i) => (
                <React.Fragment key={i}>{entry(j.title, j.company, meta([period(j.startDate, j.endDate, j.current), j.location]), j.bullets ?? [], j.bullets?.length ? "" : j.description)}</React.Fragment>
              ))}
              {end()}
            </>
          )}
          {certList.length > 0 && (
            <>
              {sec("Certifications")}
              {certList.map((c, i) => (
                <div key={i} style={{ marginTop: "0.8cqw" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ ...f(1.6), fontWeight: 700 }}>{c.name}</span>
                    <span style={{ ...f(1.345), fontWeight: 700 }}>{c.year}</span>
                  </div>
                  {c.issuer && <p style={{ ...f(1.345) }}>{c.issuer}</p>}
                </div>
              ))}
              {end()}
            </>
          )}
          {interestList.length > 0 && (
            <>
              {sec("Interests")}
              <p style={{ ...f(1.7), lineHeight: 1.55 }}>{interestList.join("  ·  ")}</p>
            </>
          )}
        </div>
      ),
    };
    return (
      <div style={{ fontFamily: font, color: INK, padding: "6cqw 5.6cqw 6cqw" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "3cqw", padding: "0 0.45cqw" }}>
          {d.photo && <Photo src={d.photo} size={9} />}
          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <p style={{ ...f(fitName(2.69, shownName, d.photo ? 60 : 82, 0.62)), fontWeight: 700, lineHeight: 1.22, color: name ? INK : "#cfcfcf", whiteSpace: "nowrap" }}>{shownName}</p>
            {d.jobTitle && <p style={{ ...f(1.5), ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p>}
            <div style={{ ...f(1.176), display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "2.2cqw", rowGap: "0.3cqw", marginTop: "0.5cqw", lineHeight: 1.3, ...glow(active === "contact") }}>
              {contactItems.length ? (
                contactItems.map((c, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "0.5cqw" }}>
                    <span style={{ display: "inline-flex", width: "1.25cqw", height: "1.25cqw" }}>{c.icon}</span>
                    {c.text}
                  </span>
                ))
              ) : (
                <span>{tr("you@email.com")}</span>
              )}
            </div>
          </div>
          {d.photo && <div style={{ width: "9cqw", flexShrink: 0 }} />}
        </div>
        <div style={{ borderTop: `0.17cqw solid ${LIGHT}`, marginTop: "0.9cqw", marginLeft: "-0.45cqw", marginRight: "-0.45cqw" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {["about", "job", "education", "skills", "extras"].map((id) => (
            <React.Fragment key={id}>{blocks[id]}</React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  /* ---------- ESSENTIAL / EXECUTIVE / TECH: one column, sections placed like in the PDF ---------- */
  const single = (v: "essential" | "executive" | "tech" | "minimal" | "elegant" | "timeline" | "legal" | "press" | "health" | "corporate" | "warm" | "academic" | "halftone" | "banner") => {
    const accent = v === "executive" ? "var(--acc)" : v === "tech" ? "var(--acc)" : v === "elegant" ? "var(--acc)" : v === "timeline" ? "var(--acc)" : v === "minimal" ? "#8a8f98" : v === "essential" ? "#1a1a1a" : "var(--acc)";
    const serifFont = "Georgia, 'Times New Roman', Times, serif";
    const mono = "'Courier New', Courier, monospace";
    const phone = formatContactPhone(d.phone, d.countryCode);
    const contact = [d.address, phone, d.email, ...linksList.map((l) => displayUrl(l.url))].filter(Boolean);
    const shownName = name || "Your Name";
    const nameColor = name ? (v === "executive" ? "#ffffff" : v === "health" ? "var(--acc-dark)" : "#1a1a1a") : v === "executive" ? "#8da4c6" : "#cfcfcf";

    const sec = (t: string) =>
            v === "academic" ? (
        <div style={{ margin: "2.6cqw 0 1.6cqw" }}>
          <p style={{ ...f(1.95), fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--acc)" }}>{tr(t)}</p>
          <div style={{ borderTop: "0.12cqw solid var(--acc-soft)", marginTop: "0.5cqw" }} />
        </div>
      ) : v === "halftone" ? (
        <div style={{ margin: "3cqw 0 1.6cqw" }}>
          <p style={{ ...f(1.9), fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--acc)", display: "flex", alignItems: "center", gap: "1.2cqw" }}>
            {tr(t)}
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45cqw" }}>
              {[0.2, 0.3, 0.42, 0.56, 0.7, 0.85, 1].map((r, i) => (
                <span key={i} style={{ width: `${r * 0.9}cqw`, height: `${r * 0.9}cqw`, borderRadius: "50%", background: "var(--acc)", display: "inline-block" }} />
              ))}
            </span>
          </p>
          <div style={{ borderTop: "0.15cqw solid var(--acc-soft)", marginTop: "0.6cqw" }} />
        </div>
      ) : v === "legal" ? (
        <div style={{ margin: "2.8cqw 0 1.6cqw" }}>
          <p style={{ ...f(2), fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--acc)" }}>{tr(t)}</p>
          <div style={{ borderTop: "0.15cqw solid var(--acc)", marginTop: "0.5cqw" }} />
        </div>
      ) : v === "press" ? (
        <div style={{ margin: "2.8cqw 0 1.6cqw" }}>
          <p style={{ ...f(1.5), fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--acc)" }}>{tr(t)}</p>
          <div style={{ borderTop: "0.1cqw solid #1a1a1a", marginTop: "0.6cqw" }} />
        </div>
      ) : v === "health" ? (
        <div style={{ margin: "3cqw 0 1.6cqw" }}>
          <p style={{ ...f(1.85), fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--acc)", display: "flex", alignItems: "center", gap: "1.3cqw" }}>
            <span style={{ width: "1.2cqw", height: "1.2cqw", borderRadius: "50%", background: "var(--acc)", flexShrink: 0 }} />
            {tr(t)}
          </p>
          <div style={{ borderTop: "0.2cqw solid var(--acc-soft)", marginTop: "0.6cqw" }} />
        </div>
      ) : v === "warm" ? (
        <div style={{ margin: "3cqw 0 1.6cqw" }}>
          <span style={{ ...f(1.5), display: "inline-block", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--acc-dark)", background: "var(--acc-soft)", borderRadius: "999px", padding: "0.6cqw 2.4cqw" }}>{tr(t)}</span>
        </div>
      ) : v === "corporate" || v === "banner" ? (
        <p style={{ ...f(v === "banner" ? 1.4 : 1.45), fontWeight: 700, letterSpacing: v === "banner" ? "0.05em" : "0.1em", textTransform: "uppercase", color: "var(--acc)", lineHeight: 1.5, whiteSpace: v === "banner" ? "nowrap" : undefined }}>{tr(t)}</p>
      ) : v === "minimal" ? (
        <p style={{ ...f(1.5), fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8a8f98", margin: "4.2cqw 0 1.8cqw" }}>{tr(t)}</p>
      ) : v === "elegant" ? (
        <div style={{ margin: "2.8cqw 0 1.6cqw" }}>
          <p style={{ ...f(2), fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--acc)" }}>{tr(t)}</p>
          <div style={{ borderTop: "0.15cqw solid var(--acc-soft)", marginTop: "0.5cqw" }} />
        </div>
      ) : v === "timeline" ? (
        <div style={{ margin: "3cqw 0 1.6cqw" }}>
          <p style={{ ...f(1.85), fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--acc)", display: "flex", alignItems: "center", gap: "1.2cqw" }}>
            <span style={{ width: "1.1cqw", height: "1.1cqw", background: "var(--acc)", flexShrink: 0 }} />
            {tr(t)}
          </p>
          <div style={{ borderTop: "0.2cqw solid var(--acc-soft)", marginTop: "0.6cqw" }} />
        </div>
      ) : v === "essential" ? (
        <div style={{ margin: "2.4cqw 0 1.4cqw" }}>
          <p style={{ ...f(2), fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>{tr(t)}</p>
          <div style={{ borderTop: "0.22cqw solid #1a1a1a", marginTop: "0.4cqw" }} />
        </div>
      ) : v === "executive" ? (
        <div style={{ margin: "3cqw 0 1.6cqw" }}>
          <p style={{ ...f(1.95), fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: accent }}>{tr(t)}</p>
          <div style={{ borderTop: "0.2cqw solid var(--acc)", marginTop: "0.6cqw" }} />
        </div>
      ) : (
        <p style={{ ...f(1.85), fontWeight: 700, fontFamily: mono, color: accent, margin: "3cqw 0 1.6cqw" }}>{`// ${t.toUpperCase()}`}</p>
      );

    const head =
      v === "academic" ? (
        <div style={{ padding: "7cqw 7cqw 0", textAlign: "center" }}>
          <p style={{ ...f(fitName(3.9, shownName.toUpperCase(), 80, 0.62)), fontWeight: 700, lineHeight: 1.1, color: nameColor, whiteSpace: "nowrap", letterSpacing: "0.08em", fontFamily: serifFont }}>{shownName.toUpperCase()}</p>
          {d.jobTitle ? <p style={{ ...f(2.1), fontStyle: "italic", color: "var(--acc)", marginTop: "1cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p> : <div style={active === "about" ? glow(true) : undefined}><Skel w="26%" center mt="1cqw" /></div>}
          <p style={{ ...f(1.5), color: "#444", marginTop: "1cqw", lineHeight: 1.6, ...glow(active === "contact") }}>{contact.length ? contact.join("   |   ") : tr("you@email.com")}</p>
          <div style={{ borderTop: "0.25cqw solid var(--acc)", marginTop: "2cqw" }} />
        </div>
      ) : v === "halftone" ? (
        <div style={{ position: "relative", padding: "7cqw 7cqw 3cqw", minHeight: "19cqw" }}>
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "58%",
              height: "100%",
              backgroundImage: "radial-gradient(circle, var(--acc) 34%, transparent 36%)",
              backgroundSize: "1.5cqw 1.5cqw",
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 100%)",
              maskImage: "linear-gradient(to right, transparent 0%, #000 100%)",
              opacity: 0.9,
            }}
          />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "3cqw" }}>
            {d.photo && <Photo src={d.photo} size={12} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ ...f(fitName(4.6, shownName, d.photo ? 40 : 52, 0.62)), fontWeight: 700, lineHeight: 1.1, color: nameColor, whiteSpace: "nowrap" }}>{shownName}</p>
              {d.jobTitle ? <p style={{ ...f(2.1), color: "var(--acc)", marginTop: "0.8cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p> : <div style={active === "about" ? glow(true) : undefined}><Skel w="26%" mt="1cqw" /></div>}
              <p style={{ ...f(1.5), color: "#444", marginTop: "1.2cqw", lineHeight: 1.6, maxWidth: "52%", ...glow(active === "contact") }}>{contact.length ? contact.join("   ·   ") : tr("you@email.com")}</p>
            </div>
          </div>
        </div>
      ) : v === "banner" ? (
        // a pale band with the contact, a band of the full color with the name, and a big round photo across both; the name and the
        // contact start where the text of the sections starts
        <div style={{ position: "relative", marginBottom: "3%" }}>
          {/* the bands, the photo and the name column are all measured as shares of the width of the sheet (the height of a band is a share of
              its width too), so they keep their places however much the sheet is scaled to fit its content; only the text changes size */}
          <div style={{ background: "var(--acc-soft)", aspectRatio: "100 / 14.8", overflow: "hidden", boxSizing: "border-box", padding: `${d.jobTitle ? "2.2%" : "4.7%"} 5% 0 28.2%` }}>
            {d.jobTitle ? <p style={{ ...f(fitName(1.6, d.jobTitle, 62, 0.62) / scale), fontWeight: 700, color: "var(--acc-dark)", marginBottom: "1cqw", overflowWrap: "anywhere", hyphens: "auto", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p> : <div style={active === "about" ? glow(true) : undefined} />}
            <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", columnGap: "1.4cqw", ...glow(active === "contact") }}>
              {(() => {
                const rows = contactRows();
                // the band has a fixed height: the more there is to say, the smaller the contact lines, so nothing goes over the dark band
                const total = rows.reduce((n, r) => n + String(r.text ?? "").length, 0);
                const sz = Math.max(0.95, Math.min(1.4, 1.4 * Math.sqrt(120 / Math.max(total, 1)))) / scale;
                const left = rows.filter((r, i) => i === 0 || (i === 2 && r.text === d.address));
                const right = rows.filter((r) => !left.includes(r));
                return [left, right].map((col, ci) => (
                  <div key={ci} style={{ display: "flex", flexDirection: "column", gap: "0.55cqw" }}>
                    {(ci === 0 && !col.length ? [{ icon: <Mail size="100%" strokeWidth={2.2} />, text: tr("you@email.com") }] : col).map((c2, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "1.2cqw", ...f(sz), lineHeight: 1.3 }}>
                        {ico(c2.icon, (1.28 * sz) / 1.4, "var(--acc)")}
                        <span style={{ minWidth: 0, overflowWrap: "anywhere", hyphens: "auto" }}>{c2.text}</span>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          </div>
          <div style={{ background: "var(--acc)", aspectRatio: "100 / 7.4", display: "flex", alignItems: "center", padding: "0 5% 0 28.2%" }}>
            <p style={{ ...f(fitName(3.7, shownName.toUpperCase(), 62, 0.62) / scale), fontWeight: 700, lineHeight: 1, color: name ? "#ffffff" : "rgba(255,255,255,0.55)", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>{shownName.toUpperCase()}</p>
          </div>
          {d.photo && <div style={{ position: "absolute", left: "4.7%", top: 0, marginTop: "6%", width: "13.5%", aspectRatio: "1 / 1" }}><Photo src={d.photo} size={13.5} style={{ width: "100%", height: "100%" }} /></div>}
        </div>
      ) : v === "legal" || v === "corporate" ? (
        <div style={{ padding: "6cqw 7cqw 0" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "3cqw" }}>
            {d.photo && <Photo src={d.photo} size={10} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ ...f(fitName(v === "legal" ? 3.9 : 4.4, shownName, d.photo ? 40 : 52, 0.62)), fontWeight: 700, lineHeight: 1.1, color: nameColor, whiteSpace: "nowrap", letterSpacing: v === "legal" ? "0.06em" : "0", textTransform: v === "legal" ? "uppercase" : "none", fontFamily: v === "legal" ? serifFont : undefined }}>{shownName}</p>
              {d.jobTitle ? <p style={{ ...f(2), color: "var(--acc)", fontStyle: v === "legal" ? "italic" : "normal", marginTop: "0.8cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p> : <div style={active === "about" ? glow(true) : undefined}><Skel w="30%" mt="1cqw" /></div>}
            </div>
            <div style={{ textAlign: "right", ...f(1.5), lineHeight: 1.6, color: "#444", maxWidth: "34%", wordBreak: "break-word", ...glow(active === "contact") }}>
              {contact.length ? contact.map((c, i) => <p key={i}>{c}</p>) : <p>{tr("you@email.com")}</p>}
            </div>
          </div>
          <div style={{ borderTop: v === "legal" ? "0.3cqw solid var(--acc)" : "0.2cqw solid #1a1a1a", marginTop: "2.4cqw" }} />
          {v === "legal" && <div style={{ borderTop: "0.1cqw solid var(--acc)", marginTop: "0.5cqw" }} />}
        </div>
      ) : v === "press" ? (
        <div style={{ padding: "5cqw 7cqw 0" }}>
          <div style={{ borderTop: "0.5cqw solid #1a1a1a" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "3cqw", paddingTop: "2cqw" }}>
            {d.photo && <Photo src={d.photo} size={11} />}
            <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
              <p style={{ ...f(fitName(6, shownName, d.photo ? 56 : 80, 0.62)), fontWeight: 700, lineHeight: 1.1, color: nameColor, whiteSpace: "nowrap", fontFamily: serifFont }}>{shownName}</p>
              <div style={{ borderTop: "0.1cqw solid #1a1a1a", margin: "1.2cqw 0" }} />
              {d.jobTitle ? <p style={{ ...f(1.5), letterSpacing: "0.25em", textTransform: "uppercase", fontWeight: 700, color: "var(--acc)", fontFamily: "Helvetica, Arial, sans-serif", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p> : <div style={active === "about" ? glow(true) : undefined}><Skel w="26%" center mt="1cqw" /></div>}
              <p style={{ ...f(1.5), color: "#444", marginTop: "0.8cqw", lineHeight: 1.5, fontFamily: "Helvetica, Arial, sans-serif", ...glow(active === "contact") }}>{contact.length ? contact.join("   |   ") : tr("you@email.com")}</p>
            </div>
            {d.photo && <div style={{ width: "11cqw", flexShrink: 0 }} />}
          </div>
          <div style={{ borderTop: "0.1cqw solid #1a1a1a", marginTop: "2cqw" }} />
          <div style={{ borderTop: "0.05cqw solid #1a1a1a", marginTop: "0.4cqw" }} />
        </div>
      ) : v === "health" ? (
        <div style={{ background: "var(--acc-soft)", borderLeft: "1.1cqw solid var(--acc)", padding: "6cqw 7cqw 5cqw", display: "flex", alignItems: "center", gap: "3cqw", marginBottom: "3cqw" }}>
          {d.photo && <Photo src={d.photo} size={11} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...f(fitName(4.4, shownName, d.photo ? 60 : 82, 0.62)), fontWeight: 700, lineHeight: 1.1, color: nameColor, whiteSpace: "nowrap" }}>{shownName}</p>
            {d.jobTitle ? <p style={{ ...f(2.1), color: "var(--acc)", marginTop: "0.8cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p> : <div style={active === "about" ? glow(true) : undefined}><Skel w="26%" mt="1cqw" /></div>}
            <p style={{ ...f(1.5), color: "#444", marginTop: "1.2cqw", lineHeight: 1.6, ...glow(active === "contact") }}>{contact.length ? contact.join("   \u2022   ") : tr("you@email.com")}</p>
          </div>
        </div>
      ) : v === "warm" ? (
        <div style={{ padding: "6cqw 7cqw 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4cqw" }}>
            {d.photo && <Photo src={d.photo} size={16} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ ...f(fitName(4.6, shownName, d.photo ? 52 : 80, 0.62)), fontWeight: 700, lineHeight: 1.1, color: nameColor, whiteSpace: "nowrap" }}>{shownName}</p>
              {d.jobTitle ? <p style={{ ...f(2.1), fontWeight: 700, color: "var(--acc)", marginTop: "0.8cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p> : <div style={active === "about" ? glow(true) : undefined}><Skel w="26%" mt="1cqw" /></div>}
              <p style={{ ...f(1.5), color: "#444", marginTop: "1.2cqw", lineHeight: 1.6, ...glow(active === "contact") }}>{contact.length ? contact.join("   \u00b7   ") : tr("you@email.com")}</p>
            </div>
          </div>
          <div style={{ height: "0.5cqw", background: "var(--acc-soft)", borderRadius: "1cqw", marginTop: "3cqw" }} />
        </div>
      ) : v === "minimal" ? (
        <div style={{ padding: "7cqw 7cqw 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "3cqw" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...f(fitName(4.4, shownName, d.photo ? 60 : 82, 0.62)), fontWeight: 700, lineHeight: 1.1, color: nameColor, whiteSpace: "nowrap" }}>{shownName}</p>
            {d.jobTitle ? <p style={{ ...f(2), color: "#666", marginTop: "0.8cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p> : <div style={active === "about" ? glow(true) : undefined}><Skel w="26%" mt="1cqw" /></div>}
            <p style={{ ...f(1.5), color: "#777", marginTop: "1.4cqw", lineHeight: 1.6, ...glow(active === "contact") }}>{contact.length ? contact.join("   ·   ") : tr("you@email.com")}</p>
          </div>
          {d.photo && <Photo src={d.photo} size={11} />}
        </div>
      ) : v === "elegant" ? (
        <div style={{ padding: "6cqw 7cqw 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "3cqw" }}>
            {d.photo && <Photo src={d.photo} size={11} />}
            <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
              <p style={{ ...f(fitName(4.8, shownName, d.photo ? 56 : 80, 0.62)), fontWeight: 700, lineHeight: 1.1, color: nameColor, whiteSpace: "nowrap", fontFamily: serifFont }}>{shownName}</p>
              {d.jobTitle ? <p style={{ ...f(2.1), fontStyle: "italic", color: "var(--acc)", marginTop: "0.6cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p> : <div style={active === "about" ? glow(true) : undefined}><Skel w="26%" center mt="1cqw" /></div>}
              <p style={{ ...f(1.6), color: "#444", marginTop: "1cqw", lineHeight: 1.5, ...glow(active === "contact") }}>{contact.length ? contact.join("   |   ") : tr("you@email.com")}</p>
            </div>
            {d.photo && <div style={{ width: "11cqw", flexShrink: 0 }} />}
          </div>
          <div style={{ borderTop: "0.3cqw solid var(--acc)", marginTop: "2cqw" }} />
          <div style={{ borderTop: "0.1cqw solid var(--acc)", marginTop: "0.5cqw" }} />
        </div>
      ) : v === "timeline" ? (
        <div style={{ padding: "6cqw 7cqw 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "3cqw" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...f(fitName(4.6, shownName, d.photo ? 60 : 82, 0.62)), fontWeight: 700, lineHeight: 1.1, color: nameColor, whiteSpace: "nowrap" }}>{shownName}</p>
            {d.jobTitle ? <p style={{ ...f(2.1), fontWeight: 700, color: "var(--acc)", marginTop: "0.8cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p> : <div style={active === "about" ? glow(true) : undefined}><Skel w="26%" mt="1cqw" /></div>}
            <p style={{ ...f(1.5), color: "#444", marginTop: "1.2cqw", lineHeight: 1.6, ...glow(active === "contact") }}>{contact.length ? contact.join("   •   ") : tr("you@email.com")}</p>
            <div style={{ width: "7cqw", height: "0.5cqw", background: "var(--acc)", marginTop: "1.6cqw" }} />
          </div>
          {d.photo && <Photo src={d.photo} size={11} />}
        </div>
      ) : v === "executive" ? (
        <div style={{ background: "var(--acc)", padding: "6cqw 7cqw", display: "flex", alignItems: "center", gap: "3cqw" }}>
          {d.photo && <Photo src={d.photo} size={12} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...f(fitName(4.6, shownName, d.photo ? 44 : 52, 0.62)), fontWeight: 700, lineHeight: 1.1, color: nameColor, whiteSpace: "nowrap" }}>{shownName}</p>
            {d.jobTitle ? <p style={{ ...f(2.1), color: "#c9d6ea", marginTop: "0.8cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p> : <div style={active === "about" ? glow(true) : undefined}><Skel w="30%" mt="1cqw" /></div>}
          </div>
          <div style={{ textAlign: "right", ...f(1.6), lineHeight: 1.5, color: "#e8eef8", maxWidth: "36%", wordBreak: "break-word", ...glow(active === "contact") }}>
            {contact.length ? contact.map((c, i) => <p key={i}>{c}</p>) : <p style={{ color: "#8da4c6" }}>{tr("you@email.com")}</p>}
          </div>
        </div>
      ) : v === "tech" ? (
        <div style={{ padding: "6cqw 7cqw 0", display: "flex", gap: "3cqw" }}>
          {d.photo && <Photo src={d.photo} size={12} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ width: "6cqw", height: "0.7cqw", background: accent, marginBottom: "1.2cqw" }} />
            <p style={{ ...f(fitName(4.8, shownName, d.photo ? 62 : 80, 0.62)), fontWeight: 700, lineHeight: 1.1, color: nameColor, whiteSpace: "nowrap" }}>{shownName}</p>
            {d.jobTitle ? <p style={{ ...f(2), fontFamily: mono, fontWeight: 700, color: accent, marginTop: "0.8cqw", ...(active === "about" ? glow(true) : {}) }}>{`> ${d.jobTitle}`}</p> : <div style={active === "about" ? glow(true) : undefined}><Skel w="30%" mt="1cqw" /></div>}
            <p style={{ ...f(1.5), fontFamily: mono, color: "#555", marginTop: "1.2cqw", lineHeight: 1.5, ...glow(active === "contact") }}>
              {contact.length ? contact.join("   |   ") : tr("you@email.com")}
            </p>
            <div style={{ borderTop: "0.15cqw solid #dcdcdc", marginTop: "2cqw" }} />
          </div>
        </div>
      ) : (
        <div style={{ padding: "5.5cqw 7cqw 0", display: "flex", alignItems: "center", gap: "3cqw" }}>
          {d.photo && <Photo src={d.photo} size={11} />}
          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <p style={{ ...f(fitName(4.4, shownName, d.photo ? 60 : 82, 0.62)), fontWeight: 700, lineHeight: 1.1, color: nameColor, whiteSpace: "nowrap" }}>{shownName}</p>
            {d.jobTitle ? <p style={{ ...f(2.1), color: "#444", marginTop: "0.6cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p> : <div style={active === "about" ? glow(true) : undefined}><Skel w="26%" center mt="1cqw" /></div>}
            <p style={{ ...f(1.7), color: "#444", marginTop: "0.8cqw", lineHeight: 1.5, ...glow(active === "contact") }}>
              {contact.length ? contact.join("   |   ") : tr("you@email.com")}
            </p>
          </div>
          {d.photo && <div style={{ width: "11cqw", flexShrink: 0 }} />}
        </div>
      );

    const skillNames = d.skills;
    const plainGroups = v !== "tech" && v !== "executive" && v !== "essential";
    const skillsBlock =
      skillNames.length === 0 ? (
        <Bars widths={["80%", "55%"]} />
      ) : plainGroups && hasSkillGroups(skillNames, d.skillGroups) ? (
        <div>
          {groupSkills(skillNames, d.skillGroups).map((g, i) => (
            <p key={i} style={{ ...f(1.8), lineHeight: 1.6 }}>
              <b>{g.label || tr("Other")}:</b> {g.skills.join(", ")}
            </p>
          ))}
        </div>
      ) : v === "tech" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.9cqw" }}>
          {skillNames.map((sk) => (
            <span key={sk} style={{ ...f(1.5), fontFamily: mono, color: "var(--acc)", background: "var(--acc-soft)", borderRadius: "0.6cqw", padding: "0.5cqw 1.3cqw" }}>{sk}</span>
          ))}
        </div>
      ) : v === "executive" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", columnGap: "3cqw", rowGap: "0.9cqw" }}>
          {skillNames.map((sk) => (
            <div key={sk} style={{ display: "flex", alignItems: "center", gap: "1.2cqw", ...f(1.8) }}>
              <span style={{ width: "0.7cqw", height: "0.7cqw", background: "var(--acc)", flexShrink: 0 }} />
              <span>{sk}</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ ...f(1.8), lineHeight: 1.6 }}>{skillNames.join(v === "minimal" ? "   ·   " : "  ·  ")}</p>
      );
    // the timeline hangs its entries from a vertical line
    const tl = (node: React.ReactNode) =>
      v === "timeline" ? <div style={{ borderLeft: "0.25cqw solid var(--acc-soft)", marginLeft: "0.6cqw", paddingLeft: "3.6cqw" }}>{node}</div> : node;

    // banner: dated entries are rows of two cells. The dates sit in the left column (under the name of the section), and on the right
    // the title stays in one line with the organization and its place under it
    type BannerRow = { date: string; title: string; org?: string; place?: string; description?: string; bullets?: string[]; extra?: string[] };
    const bannerRows = (rows: BannerRow[]) => (
      <div style={{ display: "grid", gridTemplateColumns: "25.8% 1fr", columnGap: "3cqw", rowGap: "2cqw", marginTop: "1.8cqw" }}>
        {rows.map((r, i) => (
          <React.Fragment key={i}>
            <p style={{ ...f(1.6), color: "#222" }}>{r.date}</p>
            <div style={{ minWidth: 0 }}>
              <p style={{ ...f(2), fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</p>
              {(r.org || r.place) && (
                <p style={{ ...f(1.7), marginTop: "0.3cqw" }}>
                  {r.org && <b>{r.org}</b>}
                  {r.place && <span style={{ color: "#777" }}>{r.org ? " - " : ""}{r.place}</span>}
                </p>
              )}
              {r.description && <p style={{ ...f(1.8), lineHeight: 1.5, color: "#444", marginTop: "0.8cqw" }}>{tr(r.description)}</p>}
              {(r.bullets ?? []).map((b, bi) => (
                <p key={bi} style={{ ...f(1.75), lineHeight: 1.45, color: "#444", marginTop: "0.6cqw", paddingLeft: "2.2cqw", textIndent: "-1.5cqw" }}>• {b}</p>
              ))}
              {(r.extra ?? []).filter(Boolean).map((x, xi) => (
                <p key={xi} style={{ ...f(1.7), color: "#444", marginTop: "0.5cqw" }}>{x}</p>
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>
    );
    const jobRowsOf = (list: PreviewJob[]): BannerRow[] =>
      list.map((j) => ({ date: period(j.startDate, j.endDate, j.current), title: j.title, org: j.company, place: j.location, description: j.description, bullets: j.bullets }));
    const bannerJobBody = jobHas ? bannerRows(jobRowsOf(jobsList)) : <Bars widths={["60%", "35%", "92%", "80%"]} />;
    const bannerEduBody = eduHas ? (
      bannerRows(eduList.map((e) => ({ date: period(e.startDate, e.endDate, e.current), title: e.degree, org: e.school, place: e.location, extra: [honorsLine(e), e.coursework ? `${tr("Coursework:")} ${e.coursework}` : ""] })))
    ) : (
      <Bars widths={["55%", "30%"]} />
    );

    const pos = sectionPos(v === "tech" ? ["about", "skills", "job", "extras", "education"] : v === "legal" || v === "health" ? ["about", "education", "job", "skills", "extras"] : ["about", "job", "education", "skills", "extras"]);
    // the corporate look puts the name of each section in a column at the left
    const blockStyle: React.CSSProperties =
      v === "corporate"
        ? { display: "grid", gridTemplateColumns: "22% 1fr", columnGap: "3cqw", borderTop: "0.15cqw solid #e2e2e2", padding: "2cqw 0" }
        : v === "banner"
          ? { display: "grid", gridTemplateColumns: "25.8% 1fr", columnGap: "3cqw", padding: "2.2cqw 0" }
          : {};
    // a thick pale rule between the parts of one block (the banner look has one above every section)
    const bannerSep: React.CSSProperties = { borderTop: "0.55cqw solid var(--acc-soft)", marginTop: "2.2cqw", paddingTop: "2.2cqw" };
    // the banner look puts the name of a dated section alone on its row, with the entries below it
    const stackStyle: React.CSSProperties = v === "banner" ? { padding: "2.2cqw 0" } : blockStyle;
    // the banner look draws a thick pale rule above every section but the first one
    const ruled = (id: string): React.CSSProperties => (v === "banner" && pos(id) > 0 ? { borderTop: "0.55cqw solid var(--acc-soft)" } : {});
    const extrasHas = projectList.length + internList.length + certList.length + interestList.length > 0;
    const dateColor = "#777";
    void dateColor;
    return (
      <div style={{ fontFamily: v === "elegant" || v === "legal" || v === "press" || v === "academic" ? serifFont : "Helvetica, Arial, sans-serif" }}>
        {head}
        <div style={{ padding: v === "executive" ? "1.5cqw 7cqw 6cqw" : v === "essential" ? "0.5cqw 7cqw 6cqw" : v === "banner" ? "0 5% 6cqw" : "0 7cqw 6cqw", display: "flex", flexDirection: "column" }}>
          <div style={{ order: pos("about"), ...blockStyle, ...ruled("about") }}>
            {sec("Profile")}
            <div style={glow(active === "about")}>{profileBody}</div>
          </div>
          <div style={{ order: pos("job"), ...stackStyle, ...ruled("job") }}>
            {sec("Employment History")}
            <div style={glow(active === "job")}>{v === "banner" ? bannerJobBody : tl(jobBody)}</div>
          </div>
          <div style={{ order: pos("education"), ...stackStyle, ...ruled("education") }}>
            {sec("Education")}
            <div style={glow(active === "education")}>{v === "banner" ? bannerEduBody : tl(eduBody)}</div>
          </div>
          <div style={{ order: pos("skills"), ...blockStyle, ...ruled("skills") }}>
            {sec("Skills")}
            <div style={glow(active === "skills")}>{skillsBlock}</div>
            {langs.length > 0 && v !== "banner" && (
              <>
                {sec("Languages")}
                <p style={{ ...f(1.8), fontFamily: v === "tech" ? mono : undefined }}>{langs.map((l) => (l.level ? `${l.name} (${levelText(l.level)})` : l.name)).join(v === "tech" ? "   |   " : "  ·  ")}</p>
              </>
            )}
          </div>
          {v === "banner" && langs.length > 0 && (
            // the banner look draws a rule above every section, the languages included
            <div style={{ order: pos("skills"), ...blockStyle, borderTop: "0.55cqw solid var(--acc-soft)" }}>
              {sec("Languages")}
              <p style={{ ...f(1.8) }}>{langs.map((l) => (l.level ? `${l.name} (${levelText(l.level)})` : l.name)).join("  ·  ")}</p>
            </div>
          )}
          <div style={{ order: pos("extras"), ...(extrasHas ? { ...stackStyle, ...ruled("extras") } : { display: "none" }) }}>
            {projectList.length > 0 && (
              <>
                {sec("Projects")}
                {v === "banner"
                  ? bannerRows(projectList.map((x) => ({ date: period(x.startDate ?? "", x.endDate ?? "", Boolean(x.current)), title: x.name, description: x.description, bullets: x.bullets, extra: [x.link ? displayUrl(x.link) : ""] })))
                  : tl(projectsBody)}
              </>
            )}
            {internList.length > 0 && (
              <div style={v === "banner" && projectList.length > 0 ? bannerSep : undefined}>
                {sec("Internships")}
                {v === "banner" ? bannerRows(jobRowsOf(internList)) : tl(renderJobs(internList))}
              </div>
            )}
            {certList.length > 0 && (
              <div style={v === "banner" && projectList.length + internList.length > 0 ? bannerSep : undefined}>
                {sec("Certifications")}
                {v === "banner" ? bannerRows(certList.map((c) => ({ date: c.year ?? "", title: c.name, org: c.issuer }))) : tl(certsBody)}
              </div>
            )}
            {interestList.length > 0 && (v === "banner" ? (
              // the name of this section and its text share a row, like the profile and the skills
              <div style={{ display: "grid", gridTemplateColumns: "25.8% 1fr", columnGap: "3cqw", ...(projectList.length + internList.length + certList.length > 0 ? bannerSep : {}) }}>
                {sec("Interests")}
                <p style={{ ...f(1.7), lineHeight: 1.55 }}>{interestList.join("  ·  ")}</p>
              </div>
            ) : (
              <>
                {sec("Interests")}
                {tl(<p style={{ ...f(1.7), lineHeight: 1.55 }}>{interestList.join("  ·  ")}</p>)}
              </>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* ---------- MODERN and CREATIVE: drawn with the measures of their PDFs ----------
     Every number below is a size of the PDF (in points of an A4 page, 595 wide) turned into a part of the width of the sheet, with the
     same line height the PDF font has, so the sheet is the PDF seen on the screen: the same sizes and the same places. */
  const u = (pt: number) => `${(pt / 5.95).toFixed(3)}cqw`;
  const LH = 1.156; // the line height of the PDF font, as a part of its size
  const tx = (pt: number, gap = 1.5, more: React.CSSProperties = {}): React.CSSProperties => ({ fontSize: u(pt), lineHeight: LH + gap / pt, ...more });
  const P_INK = "#1a1a1a";
  const P_BODY = "#4a4a4a";
  const P_MUTED = "#6b6b6b";
  const P_HAIR = "#dcdcdc";
  const pdfDates = (s: string, e: string, c: boolean) => period(s, e, c).replace(" — ", " - ");

  /** The sizes (in points) that make Modern and Creative differ in their right column. */
  interface PdfSizes { title: number; meta: number; metaTop: number; after: number; body: number; bulletGap: number; job: number; edu: number; eduTop: number; cert: number; certText: number; certAfter: number; profile: number; profileAfter: number; ints: number }
  const MODERN_SIZES: PdfSizes = { title: 10, meta: 8, metaTop: 2, after: 5, body: 8.5, bulletGap: 3, job: 7, edu: 9, eduTop: 2, cert: 9.6, certText: 8.2, certAfter: 7, profile: 8.8, profileAfter: 6, ints: 8.8 };
  const CREATIVE_SIZES: PdfSizes = { title: 9.6, meta: 7.8, metaTop: 1.5, after: 4, body: 8.2, bulletGap: 2.6, job: 7, edu: 8, eduTop: 1.5, cert: 9.2, certText: 8, certAfter: 6, profile: 8.5, profileAfter: 8, ints: 8.6 };

  /** A job, an internship or a project of the right column (`tight`: the dates are on the title row, as for projects). */
  const pdfJobs = (list: { head: string; right: string; dates: string; description?: string; bullets: string[] }[], z: PdfSizes, tight: boolean) =>
    list.map((j, i) => (
      <div key={i} style={{ marginBottom: u(z.job) }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: u(10) }}>
          <p style={tx(z.title, 1, { fontWeight: 700, color: P_INK })}>{j.head}</p>
          <p style={tx(z.meta, 1.5, { color: P_MUTED, flexShrink: 0 })}>{tight ? j.dates : j.right}</p>
        </div>
        {!tight && j.dates && <p style={tx(z.meta, 1.5, { color: P_MUTED, marginTop: u(z.metaTop) })}>{j.dates}</p>}
        <div style={{ height: u(tight ? 1.5 : z.after) }} />
        {j.description && <p style={tx(z.body, 1.8, { color: P_BODY, marginBottom: u(3) })}>{tr(j.description)}</p>}
        {j.bullets.map((b, bi) => (
          <div key={bi} style={{ display: "flex", marginBottom: u(z.bulletGap) }}>
            <span style={{ ...tx(z.body, 1.8, { color: P_BODY }), width: u(12), flexShrink: 0, paddingLeft: u(3), boxSizing: "border-box" }}>•</span>
            <p style={tx(z.body, 1.8, { color: P_BODY, minWidth: 0 })}>{b}</p>
          </div>
        ))}
      </div>
    ));

  /** The right column: the sections in the order of the person, each with its title (and, in Modern, a hairline between them). */
  const pdfRight = (z: PdfSizes, title: (t: string) => React.ReactNode, gapBefore: (first: boolean) => React.ReactNode) => {
    const jobsRows = jobsList.map((j) => ({ head: [j.title, j.company].filter(Boolean).join(", "), right: j.location ?? "", dates: pdfDates(j.startDate, j.endDate, j.current), description: j.description, bullets: j.bullets ?? [] }));
    const internRows = internList.map((j) => ({ head: [j.title, j.company].filter(Boolean).join(", "), right: j.location ?? "", dates: pdfDates(j.startDate, j.endDate, j.current), description: j.description, bullets: j.bullets ?? [] }));
    const projectRows = projectList.map((x) => ({ head: x.name, right: "", dates: pdfDates(x.startDate ?? "", x.endDate ?? "", Boolean(x.current)), description: x.description, bullets: x.bullets ?? [] }));
    const sections: Record<string, { name: string; node: React.ReactNode; glowOn?: boolean }[]> = {
      about: d.objective.trim() ? [{ name: "Profile", glowOn: active === "about", node: <p style={tx(z.profile, 2, { color: P_BODY, marginBottom: u(z.profileAfter) })}>{d.objective}</p> }] : [{ name: "Profile", glowOn: active === "about", node: <Bars widths={["100%", "96%", "70%"]} /> }],
      job: [{ name: "Employment History", glowOn: active === "job", node: jobHas ? pdfJobs(jobsRows, z, false) : <Bars widths={["60%", "35%", "92%", "80%"]} /> }],
      education: eduHas
        ? [{
            name: "Education",
            glowOn: active === "education",
            node: eduList.map((e, i) => (
              <div key={i} style={{ marginBottom: u(z.edu) }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: u(10) }}>
                  <p style={tx(z.title, 1, { fontWeight: 700, color: P_INK })}>{[e.degree, e.school].filter(Boolean).join(", ")}</p>
                  {e.location && <p style={tx(z.meta, 1.5, { color: P_MUTED, flexShrink: 0 })}>{e.location}</p>}
                </div>
                {pdfDates(e.startDate, e.endDate, e.current) && <p style={tx(z.meta, 1.5, { color: P_MUTED, marginTop: u(z.eduTop) })}>{pdfDates(e.startDate, e.endDate, e.current)}</p>}
                {honorsLine(e) && <p style={tx(z.meta, 1.5, { color: P_BODY, marginTop: u(z.eduTop) })}>{honorsLine(e)}</p>}
                {e.coursework && <p style={tx(z.meta, 1.5, { color: P_BODY, marginTop: u(z.eduTop) })}>{tr("Coursework:")}{" "}{e.coursework}</p>}
              </div>
            )),
          }]
        : [{ name: "Education", glowOn: active === "education", node: <Bars widths={["55%", "30%"]} /> }],
      extras: [
        ...(internList.length ? [{ name: "Internships", node: pdfJobs(internRows, z, false) }] : []),
        ...(projectList.length ? [{ name: "Projects", node: pdfJobs(projectRows, z, true) }] : []),
        ...(certList.length
          ? [{
              name: "Certifications",
              node: certList.map((c, i) => (
                <div key={i} style={{ marginBottom: u(z.certAfter) }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: u(10) }}>
                    <p style={tx(z.cert, 1, { fontWeight: 700, color: P_INK })}>{c.name}</p>
                    {c.year && <p style={tx(z.meta, 1.5, { color: P_MUTED, flexShrink: 0 })}>{c.year}</p>}
                  </div>
                  {c.issuer && <p style={tx(z.certText, 1.5, { color: P_BODY, marginTop: u(1) })}>{c.issuer}</p>}
                </div>
              )),
            }]
          : []),
        ...(interestList.length ? [{ name: "Interests", node: <p style={tx(z.ints, 1.8, { color: P_BODY, marginBottom: u(6) })}>{interestList.join("  ·  ")}</p> }] : []),
      ],
    };
    let first = true;
    return orderedSections(d.sectionOrder, ["about", "job", "education", "extras"]).flatMap((id) =>
      sections[id].map((s) => {
        const isFirst = first;
        first = false;
        return (
          <div key={`${id}-${s.name}`}>
            {gapBefore(isFirst)}
            {title(s.name)}
            <div style={glow(Boolean(s.glowOn))}>{s.node}</div>
          </div>
        );
      })
    );
  };

  /** The left column: details, skills and languages. */
  const pdfDetailRows: [string, string][] = [
    ["Address", d.address],
    ["Phone", formatContactPhone(d.phone, d.countryCode)],
    ["Email", d.email],
    ...linksList.map((l): [string, string] => [l.label || "Link", labeledLink(l.label, l.url)]),
  ];
  const pdfSkillParas = (labelPt: number, textPt: number, after: number) => {
    const gs = groupSkills(d.skills, d.skillGroups);
    const grouped = hasSkillGroups(d.skills, d.skillGroups);
    return gs.map((g, i) => (
      <div key={i} style={{ marginBottom: u(after) }}>
        {(g.label || grouped) && <p style={tx(labelPt, 1, { fontWeight: 700, color: P_INK, marginBottom: u(1.5) })}>{g.label || tr("Other")}</p>}
        <p style={tx(textPt, 1.8, { color: P_INK })}>{g.skills.join(", ")}</p>
      </div>
    ));
  };
  const noSkillLevels = d.skills.every((s) => skillLevel(d.skillLevels, s) === 0);

  const modern = () => {
    const title = (t: string) => (
      <div style={{ marginBottom: u(10) }}>
        <p style={tx(12.8, 1.5, { fontWeight: 700, letterSpacing: u(1.2), textTransform: "uppercase", color: P_INK })}>{tr(t)}</p>
        <div style={{ width: u(22), height: u(2.4), background: P_INK, marginTop: u(3) }} />
      </div>
    );
    const parts = (name || "Your Name").split(/\s+/);
    const topName = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0];
    const bottomName = parts.length > 1 ? parts[parts.length - 1] : "";
    const longest = Math.max(topName.length, bottomName.length);
    const nameSize = Math.min(29.2, fitName(29.2 / 5.95, "x".repeat(longest), d.photo ? 60 : 82, 0.8) * 5.95);
    return (
      <div style={{ padding: `${u(42)} ${u(46)} 0` }}>
        <div ref={headRef} style={{ zoom: colScale.l }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: u(18) }}>
            <div style={{ minWidth: 0 }}>
              {[topName, bottomName].filter(Boolean).map((line, i) => (
                <p key={i} style={tx(nameSize, -2, { fontWeight: 700, textTransform: "uppercase", letterSpacing: u(1.05), color: name ? P_INK : "#d4d4d4", whiteSpace: "nowrap", marginBottom: i === 0 && bottomName ? u(-2) : 0 })}>{line}</p>
              ))}
              {d.jobTitle ? (
                <p style={tx(10.5, 1.5, { color: P_MUTED, marginTop: u(5), ...(active === "about" ? glow(true) : {}) })}>{d.jobTitle}</p>
              ) : (
                <div style={active === "about" ? glow(true) : undefined}><Skel w="30%" mt="2.4cqw" /></div>
              )}
            </div>
            {d.photo && <Photo src={d.photo} size={64 / 5.95} />}
          </div>
          <div style={{ borderTop: `${u(0.8)} solid ${P_HAIR}`, marginTop: u(14), marginBottom: u(16) }} />
        </div>
        <div ref={colsRef} style={{ display: "grid", gridTemplateColumns: `${u(138)} 1fr`, columnGap: u(26), alignItems: "start", position: "relative" }}>
          <div style={{ position: "absolute", top: `calc(${u(16)} * -${colScale.l})`, left: `calc(${u(138)} + ${u(13)})`, width: u(0.6), height: divH ?? "40cqw", background: P_HAIR }} />
          <div ref={leftRef} style={{ zoom: colScale.l }}>
            {title("Details")}
            <div style={glow(active === "contact")}>
              {pdfDetailRows.map(([label, value]) =>
                label === "Address" || label === "Phone" || label === "Email" || value ? (
                  <div key={label + value} style={{ marginBottom: u(8) }}>
                    <p style={tx(7, 1.5, { fontWeight: 700, letterSpacing: u(0.4), textTransform: "uppercase", color: P_INK, marginBottom: u(1) })}>{tr(label)}</p>
                    {value ? <p style={tx(8.5, 1.5, { color: P_BODY, wordBreak: "break-word" })}>{value}</p> : <Bars widths={["70%"]} />}
                  </div>
                ) : null
              )}
            </div>
            <div style={{ height: u(10) }} />
            {title("Skills")}
            <div style={glow(active === "skills")}>
              {d.skills.length === 0 ? (
                <Bars widths={["80%", "65%"]} />
              ) : noSkillLevels ? (
                pdfSkillParas(8.8, 8.6, 7)
              ) : (
                d.skills.map((s) => (
                  <div key={s} style={{ marginBottom: u(8) }}>
                    <p style={tx(8.8, 1.5, { color: P_INK, marginBottom: u(3) })}>{s}</p>
                    {skillLevel(d.skillLevels, s) > 0 && (
                      <div style={{ height: u(2.6), background: "#d6d6d6" }}>
                        <div style={{ height: "100%", width: `${(skillLevel(d.skillLevels, s) / 5) * 100}%`, background: P_INK }} />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {langs.length > 0 && (
              <>
                <div style={{ height: u(10) }} />
                {title("Languages")}
                <div style={glow(active === "skills")}>
                  {langs.map((l) => (
                    <div key={l.name} style={{ marginBottom: u(8) }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: u(3) }}>
                        <span style={tx(8.8, 1.5, { color: P_INK })}>{l.name}</span>
                        <span style={tx(7, 1.5, { color: P_MUTED })}>{levelText(l.level)}</span>
                      </div>
                      <div style={{ height: u(2.6), background: "#d6d6d6" }}>
                        <div style={{ height: "100%", width: `${levelFraction(l.level) * 100}%`, background: P_INK }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div ref={rightRef} style={{ zoom: colScale.r }}>
            {pdfRight(
              MODERN_SIZES,
              title,
              (first) => (first ? null : <><div style={{ height: u(4) }} /><div style={{ borderTop: `${u(0.6)} solid ${P_HAIR}` }} /><div style={{ height: u(14) }} /></>)
            )}
          </div>
        </div>
      </div>
    );
  };

  const creative = () => {
    const title = (t: string) => (
      <div style={{ marginBottom: u(9) }}>
        <p style={tx(9.5, 1.5, { fontWeight: 700, letterSpacing: u(1), textTransform: "uppercase", color: P_INK })}>{tr(t)}</p>
        <div style={{ borderTop: `${u(0.9)} solid ${P_INK}`, marginTop: u(3) }} />
      </div>
    );
    const boxH = d.jobTitle ? 74 : 58;
    const nm = (name || "Your Name").toUpperCase();
    const nameSize = Math.min(17, fitName(17 / 5.95, nm, 292 / 5.95 - 4, 0.86) * 5.95);
    return (
      <div style={{ position: "relative" }}>
        {d.photo && <Photo src={d.photo} size={Math.min(60, (595 - 292) / 4 - 16) / 5.95} style={{ position: "absolute", left: `calc(${u((595 - 292) / 4)} - ${(Math.min(60, (595 - 292) / 4 - 16) / 5.95 / 2).toFixed(3)}cqw)`, top: `calc(${u(36 + boxH / 2)} - ${(Math.min(60, (595 - 292) / 4 - 16) / 5.95 / 2).toFixed(3)}cqw)` }} />}
        <div style={{ position: "relative", padding: `${u(36)} ${u(40)} 0 0` }}>
          <div ref={headRef} style={{ zoom: colScale.l }}>
            <div style={{ border: `${u(1.4)} solid ${P_INK}`, background: "#fff", boxSizing: "border-box", textAlign: "center", width: u(292), height: u(boxH), margin: `0 auto 0 calc((100% - ${u(292)}) / 2)`, display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${u(12)}` }}>
              <p style={tx(nameSize, 1.5, { fontWeight: 700, letterSpacing: u(2), textTransform: "uppercase", color: name ? P_INK : "#d4d4d4", whiteSpace: "nowrap" })}>{name ? name.toUpperCase() : tr("Your Name")}</p>
              {d.jobTitle ? (
                <p style={tx(8.5, 1.5, { letterSpacing: u(1), textTransform: "uppercase", color: P_BODY, marginTop: u(4), ...(active === "about" ? glow(true) : {}) })}>{d.jobTitle}</p>
              ) : (
                <div style={active === "about" ? glow(true) : undefined}><Skel w="38%" center mt="1.6cqw" /></div>
              )}
            </div>
            <div style={{ height: u(30) }} />
          </div>
          <div ref={colsRef} style={{ display: "grid", gridTemplateColumns: `${u(138)} 1fr`, columnGap: u(46), alignItems: "start", paddingLeft: u(26) }}>
            <div ref={leftRef} style={{ zoom: colScale.l }}>
              {title("Details")}
              <div style={glow(active === "contact")}>
                {pdfDetailRows.map(([label, value]) =>
                  label === "Address" || label === "Phone" || label === "Email" || value ? (
                    <div key={label + value} style={{ marginBottom: u(7) }}>
                      <p style={tx(6.5, 1.5, { fontWeight: 700, letterSpacing: u(0.4), textTransform: "uppercase", color: P_INK, marginBottom: u(1) })}>{tr(label)}</p>
                      {value ? <p style={tx(7.8, 1.5, { color: P_BODY, wordBreak: "break-word" })}>{value}</p> : <Bars widths={["70%"]} />}
                    </div>
                  ) : null
                )}
              </div>
              <div style={{ height: u(12) }} />
              {title("Skills")}
              <div style={glow(active === "skills")}>
                {d.skills.length === 0 ? (
                  <Bars widths={["80%", "65%"]} />
                ) : noSkillLevels ? (
                  pdfSkillParas(8.4, 8.2, 6)
                ) : (
                  d.skills.map((s) => (
                    <div key={s} style={{ marginBottom: u(4.5), display: "flex", alignItems: "center", justifyContent: "space-between", gap: u(6) }}>
                      <p style={tx(8.4, 1.5)}>{s}</p>
                      {skillLevel(d.skillLevels, s) > 0 && <DotRow level={skillLevel(d.skillLevels, s)} />}
                    </div>
                  ))
                )}
              </div>
              {langs.length > 0 && (
                <>
                  <div style={{ height: u(12) }} />
                  {title("Languages")}
                  <div style={glow(active === "skills")}>
                    {langs.map((l) => (
                      <div key={l.name} style={{ marginBottom: u(6) }}>
                        <p style={tx(8.4, 1.5, { color: P_INK })}>{l.name}</p>
                        {l.level && <p style={tx(7.2, 1.5, { color: P_MUTED, marginTop: u(1) })}>{levelText(l.level)}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div ref={rightRef} style={{ zoom: colScale.r }}>
              {pdfRight(CREATIVE_SIZES, title, (first) => (first ? null : <div style={{ height: u(6) }} />))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ---------- FOUR MORE LOOKS (noir, blossom, pastel, atelier): drawn like their PDFs ---------- */
  const galleryData = () => {
    const phone = formatContactPhone(d.phone, d.countryCode);
    const initials = (name || "Your Name").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
    const parts = (name || "Your Name").split(/\s+/).filter(Boolean);
    const places = (j: PreviewJob) => [j.company, j.location].filter(Boolean).join(", ");
    return { phone, initials, first: parts[0] ?? "", rest: parts.slice(1).join(" "), places };
  };
  /** The contact details with their icons: an envelope, a phone, a house, "in" for LinkedIn and a planet for any other web address. */
  const contactRows = (): { icon: React.ReactNode; text: string }[] => {
    const phone = formatContactPhone(d.phone, d.countryCode);
    const sz = "100%";
    return [
      { icon: <Mail size={sz} strokeWidth={2.2} />, text: d.email },
      { icon: <Smartphone size={sz} strokeWidth={2.2} />, text: phone },
      { icon: <Home size={sz} strokeWidth={2.2} />, text: d.address },
      ...linksList.map((l) => {
        const t = `${l.url} ${l.label ?? ""}`.toLowerCase();
        return { icon: t.includes("linkedin") ? <Linkedin size={sz} strokeWidth={2.2} /> : t.includes("github") ? <Github size={sz} strokeWidth={2.2} /> : <Globe size={sz} strokeWidth={2.2} />, text: shortContactLink(l.url) };
      }),
    ].filter((i) => i.text);
  };
  /** A box that holds an icon at a size (in cqw), in a color. */
  const ico = (node: React.ReactNode, size: number, color = "currentColor") => (
    <span style={{ display: "inline-block", width: `${size}cqw`, height: `${size}cqw`, flexShrink: 0, color }}>{node}</span>
  );
  const levelText2 = (l: { name: string; level?: string }) => (l.level ? `${l.name} (${levelText(l.level)})` : l.name);
  const bulletsP = (items: string[] | undefined, color = "#4a4a4a", size = 1.5) =>
    (items ?? []).map((b, i) => (
      <p key={i} style={{ ...f(size), lineHeight: 1.45, color, marginTop: "0.5cqw", paddingLeft: "1.9cqw", textIndent: "-1.4cqw" }}>• {b}</p>
    ));

  // the skills as short paragraphs, one per group (as in the PDF), instead of one row each
  const skillParas = (size: number) => {
    const gs = groupSkills(d.skills, d.skillGroups);
    const grouped = hasSkillGroups(d.skills, d.skillGroups);
    return gs.map((g, i) => (
      <div key={i} style={{ marginBottom: "1.6cqw" }}>
        {(g.label || grouped) && <p style={{ ...f(size), fontWeight: 700 }}>{g.label || tr("Other")}</p>}
        <p style={{ ...f(size), lineHeight: 1.45 }}>{g.skills.join(", ")}</p>
      </div>
    ));
  };
  const noir = () => {
    const g = galleryData();
    // every section has a small icon of its own where the black square used to be
    const SECTION_ICON: Record<string, React.ReactNode> = {
      "About Me": <User size="100%" strokeWidth={2} />,
      Contact: <BookUser size="100%" strokeWidth={2} />,
      Skills: <Settings size="100%" strokeWidth={2} />,
      Languages: <Languages size="100%" strokeWidth={2} />,
      Interests: <Heart size="100%" strokeWidth={2} />,
      Education: <GraduationCap size="100%" strokeWidth={2} />,
      "Employment History": <Briefcase size="100%" strokeWidth={2} />,
      Projects: <FolderKanban size="100%" strokeWidth={2} />,
      Internships: <Building2 size="100%" strokeWidth={2} />,
      Certifications: <Award size="100%" strokeWidth={2} />,
    };
    const head = (t: string) => (
      <p style={{ ...f(2.45), fontWeight: 700, display: "flex", alignItems: "center", gap: "1.5cqw", marginBottom: "1.6cqw", color: "#1a1a1a" }}>
        <span style={{ width: "2.5cqw", height: "2.5cqw", flexShrink: 0, display: "flex" }}>{SECTION_ICON[t] ?? null}</span>
        {tr(t)}
      </p>
    );
    const rentry = (when: string, org: string, sub: string, bullets: string[] = [], desc = "") => (
      <div style={{ position: "relative", paddingLeft: "2.7cqw", marginBottom: "2cqw" }}>
        <span style={{ position: "absolute", left: 0, top: "0.5cqw", width: "1.2cqw", height: "1.2cqw", borderRadius: "50%", background: "var(--acc-dark)" }} />
        {when && <p style={{ ...f(1.78), fontWeight: 700 }}>({when})</p>}
        {org && <p style={{ ...f(1.45), fontWeight: 700, textTransform: "uppercase", marginTop: "0.4cqw" }}>{org}</p>}
        {sub && <p style={{ ...f(1.5), color: "#555", marginTop: "0.3cqw" }}>{sub}</p>}
        {desc && <p style={{ ...f(1.5), lineHeight: 1.45, color: "#444", marginTop: "0.4cqw" }}>{tr(desc)}</p>}
        {bulletsP(bullets)}
      </div>
    );
    const contactItems = contactRows();
    const bl = (items: string[]) => items.map((x, i) => <p key={i} style={{ ...f(1.65), marginBottom: "1.1cqw", paddingLeft: "2.1cqw", textIndent: "-1.6cqw" }}>• {x}</p>);
    return (
      <div style={{ paddingTop: "7.7cqw" }}>
        {/* a soft shadow under the band */}
        <div style={{ position: "absolute", left: 0, right: 0, top: "32.9cqw", height: "6.7cqw", background: "linear-gradient(rgba(0,0,0,0.16), rgba(0,0,0,0))", pointerEvents: "none" }} />
        <div style={{ background: "var(--acc)", height: "25.2cqw", position: "relative", color: "#fff" }}>
          {/* the round photo is bigger than the band: it crosses it. Without a photo there is nothing of it */}
          {d.photo && (
            <div style={{ position: "absolute", left: "19.5%", top: "50%", transform: "translate(-50%, -50%)", width: "24.3cqw", aspectRatio: "1 / 1", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
              <Photo src={d.photo} size={29.6} style={{ borderRadius: "50%", width: "98.5%", height: "auto", aspectRatio: "1 / 1" }} />
            </div>
          )}
          <div style={{ position: "absolute", left: d.photo ? "45.7%" : "5.4%", right: "4%", top: "4.4cqw", ...glow(active === "contact") }}>
            <p style={{ ...f(fitName(6.4, g.first, d.photo ? 46 : 80, 0.62)), fontWeight: 700, letterSpacing: "0.16em", lineHeight: 1.05, whiteSpace: "nowrap", color: name ? "#fff" : "rgba(255,255,255,0.55)" }}>{g.first || "Your"}</p>
            {(g.rest || !name) && <p style={{ ...f(fitName(6.4, g.rest || "Name", d.photo ? 46 : 80, 0.62)), letterSpacing: "0.16em", lineHeight: 1.05, whiteSpace: "nowrap", color: name ? "#fff" : "rgba(255,255,255,0.55)" }}>{g.rest || "Name"}</p>}
            {d.jobTitle && <p style={{ ...f(2.5), marginTop: "1.4cqw", color: "#e6e8ee", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p>}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "39% 1fr", alignItems: "start" }}>
          <div style={{ padding: "6.7cqw 10.3% 6cqw 12.1%", minWidth: 0 }}>
            {d.objective.trim() && (
              <div style={{ marginBottom: "3cqw", ...glow(active === "about") }}>
                {head("About Me")}
                <p style={{ ...f(1.6), lineHeight: 1.5, textAlign: "justify", color: "#1a1a1a" }}>{d.objective}</p>
              </div>
            )}
            <div style={{ marginBottom: "3cqw", ...glow(active === "contact") }}>
              {head("Contact")}
              {(contactItems.length ? contactItems : [{ icon: <Mail size="100%" strokeWidth={2.2} />, text: tr("you@email.com") }]).map((c, i) => (
                <p key={i} style={{ ...f(1.65), display: "flex", alignItems: "flex-start", gap: "1.5cqw", marginBottom: "1.1cqw", wordBreak: "break-word" }}>
                  {ico(c.icon, 1.6, "#1a1a1a")}
                  <span style={{ minWidth: 0 }}>{c.text}</span>
                </p>
              ))}
            </div>
            {d.skills.length > 0 && <div style={{ marginBottom: "3cqw", ...glow(active === "skills") }}>{head("Skills")}{skillParas(1.6)}</div>}
            {langs.length > 0 && <div style={{ marginBottom: "3cqw" }}>{head("Languages")}{bl(langs.map(levelText2))}</div>}
            {interestList.length > 0 && <div>{head("Interests")}{bl(interestList)}</div>}
          </div>
          <div style={{ padding: "6.7cqw 9.3% 6cqw 8.2%", minWidth: 0 }}>
            {eduHas && (
              <div style={{ marginBottom: "2cqw", ...glow(active === "education") }}>
                {head("Education")}
                {eduList.map((e, i) => <React.Fragment key={i}>{rentry(period(e.startDate, e.endDate, e.current), e.school || e.degree, e.school ? e.degree : "", [], [honorsLine(e), e.coursework ?? ""].filter(Boolean).join("\n"))}</React.Fragment>)}
              </div>
            )}
            {jobHas && (
              <div style={{ marginBottom: "2cqw", ...glow(active === "job") }}>
                {head("Employment History")}
                {jobsList.map((j, i) => <React.Fragment key={i}>{rentry(period(j.startDate, j.endDate, j.current), j.title, g.places(j), j.bullets, j.description)}</React.Fragment>)}
              </div>
            )}
            {projectList.length > 0 && (
              <div style={{ marginBottom: "2cqw" }}>
                {head("Projects")}
                {projectList.map((x, i) => <React.Fragment key={i}>{rentry(period(x.startDate ?? "", x.endDate ?? "", Boolean(x.current)), x.name, "", x.bullets, x.description ?? "")}</React.Fragment>)}
              </div>
            )}
            {internList.length > 0 && (
              <div style={{ marginBottom: "2cqw" }}>
                {head("Internships")}
                {internList.map((j, i) => <React.Fragment key={i}>{rentry(period(j.startDate, j.endDate, j.current), j.title, g.places(j), j.bullets, j.description)}</React.Fragment>)}
              </div>
            )}
            {certList.length > 0 && (
              <div>
                {head("Certifications")}
                {certList.map((c, i) => <React.Fragment key={i}>{rentry(c.year ?? "", c.name, c.issuer ?? "")}</React.Fragment>)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const blossom = () => {
    const g = galleryData();
    const BROWN = "color-mix(in srgb, var(--acc) 80%, #000)";
    const pill = (t: string, shift = false) => (
      <span style={{ ...f(2.35), display: "inline-block", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: BROWN, background: "var(--acc-soft)", borderRadius: "999px", padding: "1.2cqw 2.7cqw", marginBottom: "2.3cqw", marginLeft: shift ? "2.4cqw" : 0 }}>{tr(t)}</span>
    );
    const dotted = (node: React.ReactNode) => (
      <div style={{ position: "relative", paddingLeft: "3.7cqw", marginBottom: "2.2cqw" }}>
        <span style={{ position: "absolute", left: "-0.75cqw", top: "0.6cqw", width: "1.5cqw", height: "1.5cqw", borderRadius: "50%", background: BROWN }} />
        {node}
      </div>
    );
    const rentry = (when: string, org: string, sub: string, bullets: string[] = [], desc = "") =>
      dotted(
        <>
          {when && <p style={{ ...f(2.15), fontWeight: 700, color: BROWN }}>{when}</p>}
          {org && <p style={{ ...f(2.12), fontWeight: 700, color: BROWN, marginTop: "0.5cqw" }}>{org}</p>}
          {sub && <p style={{ ...f(1.88), color: BROWN, marginTop: "0.5cqw" }}>{sub}</p>}
          {desc && <p style={{ ...f(1.85), lineHeight: 1.45, color: BROWN, marginTop: "0.5cqw" }}>{tr(desc)}</p>}
          {bulletsP(bullets, BROWN, 1.85)}
        </>
      );
    const contactItems = contactRows();
    return (
      <div style={{ position: "relative", color: BROWN }}>
        {d.photo && (
          <>
            <div style={{ position: "absolute", right: "5.9%", top: 0, width: "32.3cqw", height: "37.5cqw", background: "color-mix(in srgb, var(--acc) 55%, white)", borderRadius: "0 0 999px 999px" }} />
            <div style={{ position: "absolute", right: "3.2%", top: 0, width: "5cqw", height: "32cqw", background: "color-mix(in srgb, var(--acc) 22%, white)", borderRadius: "999px" }} />
            <div style={{ position: "absolute", right: "calc(5.9% + 4.05cqw)", top: "8.1cqw", width: "24.2cqw", aspectRatio: "1 / 1", borderRadius: "50%", overflow: "hidden" }}>
              <Photo src={d.photo} size={32} style={{ borderRadius: "50%", width: "100%", height: "100%" }} />
            </div>
          </>
        )}
        <div style={{ position: "relative", padding: "7.5cqw 0 0 8%", width: d.photo ? "61%" : "56%", height: d.photo ? "35.9cqw" : undefined, boxSizing: "border-box", ...glow(active === "contact") }}>
          {(() => {
            // one word per line (three lines at most), all of the same size: the one that makes the longest word fit
            const words = (name || "Your Name").toUpperCase().split(/\s+/).filter(Boolean);
            const lines = words.length > 3 ? [words[0], words.slice(1, -1).join(" "), words[words.length - 1]] : words;
            const size = Math.min(9.6, ...lines.map((t) => fitName(9.6, t, d.photo ? 51 : 46, 0.74)));
            return (
              <>
                {lines.map((t, i) => <p key={i} style={{ ...f(size), letterSpacing: "0.07em", lineHeight: 0.95, whiteSpace: "nowrap" }}>{t}</p>)}
              </>
            );
          })()}
          {!d.photo && d.jobTitle && <p style={{ ...f(3.2), fontWeight: 700, marginTop: "2.4cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p>}
        </div>
        {/* with no photo the contact takes the empty space at the right of the name */}
        {!d.photo && (
          <div style={{ position: "absolute", left: "65.2%", top: "11.8cqw", width: "28%", ...glow(active === "contact") }}>
            {(contactItems.length ? contactItems : [{ icon: <Mail size="100%" strokeWidth={2.2} />, text: tr("you@email.com") }]).map((c, i) => (
              <p key={i} style={{ ...f(1.92), display: "flex", alignItems: "center", gap: "2cqw", marginBottom: "1.4cqw", wordBreak: "break-word" }}>
                <span style={{ width: "2.7cqw", height: "2.7cqw", borderRadius: "50%", background: BROWN, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{ico(c.icon, 1.55, "#fff")}</span>
                {c.text}
              </p>
            ))}
          </div>
        )}
        {d.photo && (
          <div style={{ position: "relative", padding: "0 0 0 8%", minHeight: "24cqw" }}>
            {d.jobTitle && <p style={{ ...f(3.2), fontWeight: 700, marginBottom: "2cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p>}
            {(contactItems.length ? contactItems : [{ icon: <Mail size="100%" strokeWidth={2.2} />, text: tr("you@email.com") }]).map((c, i) => (
              <p key={i} style={{ ...f(1.92), display: "flex", alignItems: "center", gap: "2cqw", marginBottom: "1.4cqw", maxWidth: "44%", wordBreak: "break-word" }}>
                <span style={{ width: "2.7cqw", height: "2.7cqw", borderRadius: "50%", background: BROWN, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{ico(c.icon, 1.55, "#fff")}</span>
                {c.text}
              </p>
            ))}
          </div>
        )}
        {!d.photo && <div style={{ height: "10cqw" }} />}
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "45.7% 1fr", padding: "3.6cqw 6% 6cqw 0", columnGap: 0 }}>
          <div style={{ padding: "0 9.3% 0 18.8%", minWidth: 0 }}>
            {eduHas && (
              <div style={{ marginBottom: "3cqw", ...glow(active === "education") }}>
                {pill("Education")}
                {eduList.map((e, i) => (
                  <div key={i} style={{ marginBottom: "2cqw" }}>
                    <p style={{ ...f(2.28), fontWeight: 700 }}>{period(e.startDate, e.endDate, e.current)}</p>
                    <p style={{ ...f(2.28), fontWeight: 700, marginTop: "0.5cqw" }}>{e.school || e.degree}</p>
                    {e.school && e.degree && <p style={{ ...f(2.14), marginTop: "0.5cqw" }}>{e.degree}</p>}
                    {honorsLine(e) && <p style={{ ...f(1.92), marginTop: "0.5cqw" }}>{honorsLine(e)}</p>}
                  </div>
                ))}
              </div>
            )}
            {d.skills.length > 0 && (
              <div style={{ marginBottom: "3cqw", ...glow(active === "skills") }}>
                {pill("Skills")}
                {d.skills.every((s) => skillLevel(d.skillLevels, s) === 0) ? (
                  // no levels to draw: the skills go in short paragraphs, one per group, as in the PDF (one row each took the whole page)
                  (() => {
                    const gs = groupSkills(d.skills, d.skillGroups);
                    const grouped = hasSkillGroups(d.skills, d.skillGroups);
                    return gs.map((g, i) => (
                      <div key={i} style={{ marginBottom: "2.2cqw" }}>
                        {(g.label || grouped) && <p style={{ ...f(1.95), fontWeight: 700 }}>{g.label || tr("Other")}</p>}
                        <p style={{ ...f(1.9), lineHeight: 1.45 }}>{g.skills.join(", ")}</p>
                      </div>
                    ));
                  })()
                ) : (
                  d.skills.map((s) => (
                    <div key={s} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", columnGap: "2cqw", marginBottom: "2cqw", ...f(2.14) }}>
                      <span>{s}</span>
                      {skillLevel(d.skillLevels, s) > 0 ? (
                        <span style={{ height: "0.92cqw", borderRadius: "999px", background: "var(--acc-soft)", display: "block" }}>
                          <span style={{ display: "block", height: "100%", borderRadius: "999px", background: BROWN, width: `${(skillLevel(d.skillLevels, s) / 5) * 100}%` }} />
                        </span>
                      ) : <span />}
                    </div>
                  ))
                )}
              </div>
            )}
            {langs.length > 0 && <div style={{ marginBottom: "3cqw" }}>{pill("Languages")}{langs.map((l, i) => <p key={i} style={{ ...f(2.14), marginBottom: "1.6cqw", paddingLeft: "0.8cqw" }}>{levelText2(l)}</p>)}</div>}
            {interestList.length > 0 && <div>{pill("Interests")}{interestList.map((x, i) => <p key={i} style={{ ...f(2.14), marginBottom: "1.6cqw", paddingLeft: "0.8cqw" }}>{x}</p>)}</div>}
          </div>
          <div style={{ minWidth: 0, position: "relative" }}>
            {/* the vertical line of the timeline runs along the entries, from the first dot to the last */}
            <div style={{ position: "absolute", left: "-0.13cqw", top: "0.8cqw", bottom: "1.6cqw", width: "0.27cqw", background: BROWN }} />
            {d.objective.trim() && <div style={glow(active === "about")}>{dotted(<p style={{ ...f(1.92), lineHeight: 1.6 }}>{d.objective}</p>)}</div>}
            {jobHas && (
              <div style={{ marginBottom: "2cqw", ...glow(active === "job") }}>
                {pill("Work experience", true)}
                {jobsList.map((j, i) => <React.Fragment key={i}>{rentry(period(j.startDate, j.endDate, j.current), j.title, g.places(j), j.bullets, j.description)}</React.Fragment>)}
              </div>
            )}
            {projectList.length > 0 && <div>{pill("Projects", true)}{projectList.map((x, i) => <React.Fragment key={i}>{rentry(period(x.startDate ?? "", x.endDate ?? "", Boolean(x.current)), x.name, "", x.bullets, x.description ?? "")}</React.Fragment>)}</div>}
            {internList.length > 0 && <div>{pill("Internships", true)}{internList.map((j, i) => <React.Fragment key={i}>{rentry(period(j.startDate, j.endDate, j.current), j.title, g.places(j), j.bullets, j.description)}</React.Fragment>)}</div>}
            {certList.length > 0 && <div>{pill("Certifications", true)}{certList.map((c, i) => <React.Fragment key={i}>{rentry(c.year ?? "", c.name, c.issuer ?? "")}</React.Fragment>)}</div>}
          </div>
        </div>
      </div>
    );
  };

  const pastel = () => {
    const g = galleryData();
    const P = pastelPalette(accentHex("pastel", d.accent));
    const NAVY = P.ink;
    const head = (t: string) => <p style={{ ...f(2.45), fontWeight: 700, color: NAVY, margin: "0 0 1.2cqw" }}>{tr(t)}</p>;
    const entry = (title: string, when: string, bullets: string[] = [], desc = "") => (
      <div style={{ marginBottom: "1.8cqw" }}>
        <p style={{ ...f(1.65), fontWeight: 700 }}>{title}</p>
        {when && <p style={{ ...f(1.15), fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: P.date, marginTop: "0.3cqw" }}>{when}</p>}
        {desc && <p style={{ ...f(1.5), lineHeight: 1.45, color: "#444", marginTop: "0.5cqw" }}>{tr(desc)}</p>}
        {bulletsP(bullets)}
      </div>
    );
    const contactItems = contactRows();
    return (
      <div style={{ position: "relative", padding: "5cqw 6.7% 6cqw 6.9%", display: "grid", gridTemplateColumns: "64.2% 1fr", columnGap: "8.3%", alignItems: "start" }}>
          <div style={{ minWidth: 0 }}>
            {/* the name, the role and the summary, then the main column right under them: the two columns flow on their own */}
            <div style={{ marginBottom: "3.4cqw", ...glow(active === "contact") }}>
              <p style={{ ...f(fitName(7.1, name || "Your Name", 56.5, 0.7)), fontWeight: 700, color: NAVY, lineHeight: 1.12, whiteSpace: "nowrap" }}>{name || "Your Name"}</p>
              {d.jobTitle && <p style={{ ...f(fitName(3.7, d.jobTitle, 56.5, 0.7)), fontWeight: 700, color: NAVY, marginTop: "0.5cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p>}
              {d.objective.trim() && <p style={{ ...f(1.71), lineHeight: 1.55, marginTop: "2cqw", ...(active === "about" ? glow(true) : {}) }}>{d.objective}</p>}
            </div>
            {jobHas && (
              <div style={{ marginBottom: "2.6cqw", ...glow(active === "job") }}>
                {head("Employment History")}
                {jobsList.map((j, i) => <React.Fragment key={i}>{entry([j.title, g.places(j)].filter(Boolean).join(" at "), period(j.startDate, j.endDate, j.current), j.bullets, j.description)}</React.Fragment>)}
              </div>
            )}
            {eduHas && (
              <div style={{ marginBottom: "2.6cqw", ...glow(active === "education") }}>
                {head("Education")}
                {eduList.map((e, i) => <React.Fragment key={i}>{entry([e.degree, [e.school, e.location].filter(Boolean).join(", ")].filter(Boolean).join(" at "), period(e.startDate, e.endDate, e.current), [], honorsLine(e))}</React.Fragment>)}
              </div>
            )}
            {projectList.length > 0 && <div style={{ marginBottom: "2.6cqw" }}>{head("Projects")}{projectList.map((x, i) => <React.Fragment key={i}>{entry(x.name, period(x.startDate ?? "", x.endDate ?? "", Boolean(x.current)), x.bullets, x.description ?? "")}</React.Fragment>)}</div>}
            {internList.length > 0 && <div style={{ marginBottom: "2.6cqw" }}>{head("Internships")}{internList.map((j, i) => <React.Fragment key={i}>{entry([j.title, j.company].filter(Boolean).join(" at "), period(j.startDate, j.endDate, j.current), j.bullets, j.description)}</React.Fragment>)}</div>}
            {certList.length > 0 && <div>{head("Certifications")}{certList.map((c, i) => <React.Fragment key={i}>{entry([c.name, c.issuer].filter(Boolean).join(", "), c.year ?? "")}</React.Fragment>)}</div>}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ height: "42.4cqw" }} aria-hidden />
            <div style={{ marginBottom: "2.6cqw", ...glow(active === "contact") }}>
              {head("Details")}
              {(contactItems.length ? contactItems : [{ icon: <Mail size="100%" strokeWidth={2.2} />, text: tr("you@email.com") }]).map((c, i) => (
                <p key={i} style={{ ...f(1.45), display: "flex", alignItems: "flex-start", gap: "1.2cqw", marginBottom: "0.7cqw", wordBreak: "break-word" }}>
                  {ico(c.icon, 1.35, NAVY)}
                  <span style={{ minWidth: 0 }}>{c.text}</span>
                </p>
              ))}
            </div>
            {d.skills.length > 0 && (
              <div style={{ marginBottom: "2.6cqw", ...glow(active === "skills") }}>
                {head("Skills")}
                {d.skills.every((s) => skillLevel(d.skillLevels, s) === 0) ? skillParas(1.45) : d.skills.map((s) => (
                  <div key={s} style={{ marginBottom: "0.9cqw" }}>
                    <p style={{ ...f(1.45) }}>{s}</p>
                    {skillLevel(d.skillLevels, s) > 0 && (
                      <div style={{ display: "flex", gap: "0.5cqw", marginTop: "0.5cqw" }}>
                        {[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ flex: 1, height: "0.5cqw", background: n <= skillLevel(d.skillLevels, s) ? NAVY : P.lavenderSoft }} />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {langs.length > 0 && <div style={{ marginBottom: "2.6cqw" }}>{head("Languages")}{langs.map((l, i) => <p key={i} style={{ ...f(1.45), marginBottom: "0.6cqw" }}>{levelText2(l)}</p>)}</div>}
            {interestList.length > 0 && <div>{head("Interests")}{interestList.map((x, i) => <p key={i} style={{ ...f(1.45), marginBottom: "0.6cqw" }}>{x}</p>)}</div>}
          </div>
      </div>
    );
  };

  const atelier = () => {
    const g = galleryData();
    const SLATE = "var(--acc)";
    const head = (t: string) => (
      <div style={{ marginBottom: "1.6cqw" }}>
        <p style={{ ...f(1.6), fontWeight: 700, letterSpacing: "0.17em", textTransform: "uppercase", color: SLATE }}>{tr(t)}</p>
        <div style={{ borderTop: "0.2cqw solid var(--acc-soft)", marginTop: "0.6cqw" }} />
      </div>
    );
    const lentry = (org: string, sub: string, place: string | undefined, when: string, bullets: string[] = [], desc = "") => (
      <div style={{ marginBottom: "2cqw" }}>
        <p style={{ ...f(1.58), fontWeight: 700 }}>{[org, sub].filter(Boolean).join(" - ")}</p>
        {place && <p style={{ ...f(1.4), color: "#777" }}>{place}</p>}
        {when && <p style={{ ...f(1.4), color: "#777" }}>{when}</p>}
        {desc && <p style={{ ...f(1.5), lineHeight: 1.45, color: "#444", marginTop: "0.5cqw" }}>{tr(desc)}</p>}
        {bulletsP(bullets)}
      </div>
    );
    const bl = (items: string[]) => items.map((x, i) => <p key={i} style={{ ...f(1.48), marginBottom: "0.8cqw", paddingLeft: "1.9cqw", textIndent: "-1.4cqw" }}>• {x}</p>);
    const contactItems = contactRows();
    return (
      <div style={{ color: "#4a4a4a" }}>
        <div style={{ background: "color-mix(in srgb, var(--acc) 22%, white)", height: "22.2cqw", padding: "5.4cqw 6.7% 0", boxSizing: "border-box" }}>
          <p style={{ ...f(fitName(4.4, `${g.initials.split("").join("  ")}  /  ${(name || "Your Name").toUpperCase()}`, 86, 0.62)), letterSpacing: "0.16em", color: SLATE, whiteSpace: "nowrap", lineHeight: 1.1 }}>
            {g.initials ? `${g.initials.split("").join("  ")}  /  ` : ""}{(name || "Your Name").toUpperCase()}
          </p>
          <div style={{ ...f(1.5), color: "#1a1a1a", marginTop: "2.4cqw", lineHeight: 1.4, display: "flex", flexWrap: "wrap", columnGap: "2.7cqw", rowGap: "0.8cqw", ...glow(active === "contact") }}>
            {(contactItems.length ? contactItems : [{ icon: <Mail size="100%" strokeWidth={2.2} />, text: tr("you@email.com") }]).map((c, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "1cqw" }}>
                {ico(c.icon, 1.35, SLATE)}
                {c.text}
              </span>
            ))}
          </div>
          {d.jobTitle && <p style={{ ...f(1.6), letterSpacing: "0.1em", color: SLATE, marginTop: "1.2cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 30%", columnGap: "6.8%", padding: "4.8cqw 6.7% 6cqw" }}>
          <div style={{ minWidth: 0 }}>
            {d.objective.trim() && <div style={{ marginBottom: "3cqw", ...glow(active === "about") }}>{head("Professional Summary")}<p style={{ ...f(1.52), lineHeight: 1.6, color: "#1a1a1a" }}>{d.objective}</p></div>}
            {jobHas && (
              <div style={{ marginBottom: "3cqw", ...glow(active === "job") }}>
                {head("Work history")}
                {jobsList.map((j, i) => <React.Fragment key={i}>{lentry(j.company, j.title, j.location, period(j.startDate, j.endDate, j.current), j.bullets, j.description)}</React.Fragment>)}
              </div>
            )}
            {projectList.length > 0 && <div style={{ marginBottom: "3cqw" }}>{head("Projects")}{projectList.map((x, i) => <React.Fragment key={i}>{lentry(x.name, "", "", period(x.startDate ?? "", x.endDate ?? "", Boolean(x.current)), x.bullets, x.description ?? "")}</React.Fragment>)}</div>}
            {internList.length > 0 && <div style={{ marginBottom: "3cqw" }}>{head("Internships")}{internList.map((j, i) => <React.Fragment key={i}>{lentry(j.company, j.title, j.location, period(j.startDate, j.endDate, j.current), j.bullets, j.description)}</React.Fragment>)}</div>}
            {langs.length > 0 && (
              <div>
                {head("Languages")}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", rowGap: "1.6cqw" }}>
                  {langs.map((l, i) => <div key={i}><p style={{ ...f(1.5), fontWeight: 700, color: "#1a1a1a" }}>{l.name}</p>{l.level && <p style={{ ...f(1.4), color: "#777" }}>{levelText(l.level)}</p>}</div>)}
                </div>
              </div>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            {d.skills.length > 0 && <div style={{ marginBottom: "3cqw", ...glow(active === "skills") }}>{head("Skills")}{bl(d.skills)}</div>}
            {certList.length > 0 && <div style={{ marginBottom: "3cqw" }}>{head("Certifications")}{bl(certList.map((c) => [c.name, c.issuer, c.year].filter(Boolean).join(" - ")))}</div>}
            {eduHas && (
              <div style={{ marginBottom: "3cqw", ...glow(active === "education") }}>
                {head("Education")}
                {eduList.map((e, i) => (
                  <div key={i} style={{ marginBottom: "2cqw" }}>
                    <p style={{ ...f(1.55), fontWeight: 700, color: "#1a1a1a" }}>{e.school || e.degree}</p>
                    {e.location && <p style={{ ...f(1.4), color: "#777" }}>{e.location}</p>}
                    <p style={{ ...f(1.4), color: "#777" }}>{period(e.startDate, e.endDate, e.current)}</p>
                    {e.school && e.degree && <p style={{ ...f(1.5), color: "#1a1a1a", marginTop: "0.5cqw" }}>{e.degree}</p>}
                    {honorsLine(e) && <p style={{ ...f(1.4) }}>{honorsLine(e)}</p>}
                  </div>
                ))}
              </div>
            )}
            {interestList.length > 0 && <div>{head("Interests")}{bl(interestList)}</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div ref={cell} className="min-w-0">
    {portalIfFixed(
    <div
      className={`mx-auto w-full ${enter ? "animate-preview-in" : ""}`}
      style={
        box
          ? { position: "fixed", top: "4.5rem", left: box.left, width: box.width, zIndex: 60 }
          : { maxWidth: large ? "60rem" : "max(20rem, calc((100dvh - 8rem) * 0.7071))" }
      }
    >
      {!bare && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr("Live preview")}</p>}
      <div className="group relative">
      <div
        ref={paper}
        role="img"
        aria-label={tr("Preview of your resume")}
        className="relative aspect-[210/297] w-full overflow-hidden rounded-md bg-white text-neutral-900 shadow-2xl ring-1 ring-black/10"
        style={{ containerType: "inline-size", ...(accentVars(template, d.accent) as React.CSSProperties) }}
      >
        {template === "creative" && <div style={{ position: "absolute", inset: "0 auto 0 0", width: "30.92%", background: "#f1f1f1" }} />}
        {template === "sidebar" && <div style={{ position: "absolute", inset: "0 auto 0 0", width: "32%", background: "var(--acc-dark)" }} />}
        {template === "noir" && <div style={{ position: "absolute", inset: "0 auto 0 0", width: "39%", background: "color-mix(in srgb, var(--acc) 14%, white)" }} />}
        {template === "blossom" && (
          <>
            <div style={{ position: "absolute", inset: 0, background: "color-mix(in srgb, var(--acc) 5%, white)" }} />
            <div style={{ position: "absolute", inset: "auto 0 0 0", height: "2.4cqw", background: "color-mix(in srgb, var(--acc) 40%, white)" }} />
          </>
        )}
        {template === "pastel" && <PastelBack base={accentHex("pastel", d.accent)} photo={d.photo} />}
        <div ref={content} style={{ zoom: template === "modern" || template === "creative" || template === "sidebar" ? 1 : scale, position: "relative", fontFamily: "Helvetica, Arial, sans-serif" /* the font of the PDF: a look that has its own overrides it */ }}>
          {template === "modern" ? modern() : template === "creative" ? creative() : template === "essential" ? essential() : template === "ats" ? ats() : template === "shokumu" ? shokumu() : template === "rirekisho" ? rirekisho() : template === "sidebar" ? sidebar() : template === "executive" || template === "tech" || template === "minimal" || template === "elegant" || template === "timeline" || template === "legal" || template === "press" || template === "health" || template === "corporate" || template === "warm" || template === "academic" || template === "halftone" || template === "banner" ? single(template) : template === "noir" ? noir() : template === "blossom" ? blossom() : template === "pastel" ? pastel() : template === "atelier" ? atelier() : classic()}
        </div>
      </div>
      {onCustomize && (
        <button
          type="button"
          onClick={onCustomize}
          aria-label={tr("Customize the look")}
          title={tr("Customize the look")}
          className="absolute right-3 top-3 flex h-11 w-11 scale-90 items-center justify-center rounded-full bg-blue-600 text-white opacity-0 shadow-lg shadow-blue-900/30 transition duration-200 hover:bg-blue-700 focus-visible:scale-100 focus-visible:opacity-100 group-hover:scale-100 group-hover:opacity-100"
        >
          <Palette className="h-5 w-5" />
        </button>
      )}
      {overlay && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">{overlay}</div>}
      </div>
      {!bare && <p className="mt-2 text-center text-xs text-muted-foreground">{tr("A preview of the")}{" "}{template || tr("classic")}{" "}{tr("look. The final PDF may differ slightly.")}</p>}
    </div>
    )}
    </div>
  );
}
