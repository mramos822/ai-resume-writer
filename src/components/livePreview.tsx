// src/components/livePreview.tsx
"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Palette } from "lucide-react";

import { formatContactPhone } from "@/lib/phone";
import { orderedSections } from "@/lib/sectionOrder";
import { levelDots, levelFraction, type LanguageEntry } from "@/lib/languages";
import { skillLevel, type SkillLevels } from "@/lib/skillLevels";
import { displayUrl, type CertificationEntry, type LinkEntry } from "@/lib/links";

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
  links?: LinkEntry[];
  certifications?: CertificationEntry[];
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

const monthLabel = (v: string) => {
  if (!/^\d{4}-\d{2}$/.test(v)) return "";
  return new Date(Number(v.slice(0, 4)), Number(v.slice(5)) - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
};
const period = (start: string, end: string, current: boolean) =>
  [monthLabel(start), current ? "Present" : monthLabel(end)].filter(Boolean).join(" — ");

// Everything is sized in cqw (1% of the paper's width), so the page scales like a real sheet of paper.
const f = (n: number): React.CSSProperties => ({ fontSize: `${n}cqw` });
const GRAY = "#e4e4e4";
// never above 1: a short resume stays small on the sheet, exactly like the generated PDF
const SCALES = [1, 0.96, 0.92, 0.88, 0.84, 0.8, 0.76, 0.72, 0.68, 0.64, 0.6, 0.56, 0.52, 0.48, 0.44, 0.4];

function Photo({ src, size, style }: { src: string; size: number; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{ width: `${size}cqw`, height: `${size}cqw`, borderRadius: "50%", objectFit: "cover", flexShrink: 0, ...style }}
    />
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
  !(d.projects ?? []).length && !(d.internships ?? []).length &&
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
}) {
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
      const byHeight = Math.max(320, (window.innerHeight - 128) * 0.7727);
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
  const [scale, setScale] = useState(1);
  const [colScale, setColScale] = useState({ l: 1, r: 1 });
  const fit = useCallback(() => {
    const p = paper.current;
    const c = content.current;
    if (!p || !c) return;
    const pr = p.getBoundingClientRect();
    // the largest zoom that still fits (height only grows with zoom, so a binary search finds it in a few steps)
    const pick = (el: HTMLElement | null, limit: number) => {
      if (!el) return 1;
      const fits = (sc: number) => {
        el.style.zoom = String(sc);
        return el.getBoundingClientRect().height <= limit;
      };
      let lo = SCALES[SCALES.length - 1];
      let hi = SCALES[0];
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
      const avail = pr.height * 0.98 - (colsRef.current.getBoundingClientRect().top - pr.top);
      // one size for both columns, like the PDF: the default (1) when there is little content, smaller only when there is a lot
      const common = Math.min(pick(leftRef.current, avail), pick(rightRef.current, avail));
      setColScale({ l: common, r: common });
    } else {
      setColScale({ l: 1, r: 1 });
      const best = pick(c, pr.height * 0.98);
      setScale(best);
    }
  }, []);
  // re-fit whenever what is shown changes
  const signature = JSON.stringify(d) + template;
  useLayoutEffect(() => {
    fit();
  }, [signature, fit]);
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

  const renderJobs = (list: PreviewJob[]) => (
    <div>
      {list.map((j, ji) => (
        <div key={ji} style={{ marginTop: ji ? "2.4cqw" : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "2cqw" }}>
            <p style={{ ...f(2), fontWeight: 700 }}>{[j.title, j.company].filter(Boolean).join(", ")}</p>
            {j.location && <p style={{ ...f(1.6), color: "#777", flexShrink: 0 }}>{j.location}</p>}
          </div>
          {period(j.startDate, j.endDate, j.current) && (
            <p style={{ ...f(1.7), color: "#777", marginTop: "0.3cqw" }}>{period(j.startDate, j.endDate, j.current)}</p>
          )}
          {j.description && <p style={{ ...f(1.8), lineHeight: 1.5, color: "#444", marginTop: "0.8cqw" }}>{j.description}</p>}
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
  const projectList = (d.projects ?? []).filter((x) => x.name?.trim());
  const internList = (d.internships ?? []).filter((j) => j.title || j.company);
  // The person can move the sections: the order they chose decides where each one goes (default order until they move one)
  const sectionPos = (ids: string[]) => {
    const o = orderedSections(d.sectionOrder, ids);
    return (id: string) => o.indexOf(id);
  };
  const projectsBody = (
    <div>
      {projectList.map((x, xi) => (
        <div key={xi} style={{ marginTop: xi ? "2.4cqw" : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "2cqw" }}>
            <p style={{ ...f(2), fontWeight: 700 }}>{x.name}</p>
            {period(x.startDate ?? "", x.endDate ?? "", Boolean(x.current)) && (
              <p style={{ ...f(1.7), color: "#777", flexShrink: 0 }}>{period(x.startDate ?? "", x.endDate ?? "", Boolean(x.current))}</p>
            )}
          </div>
          {x.description && <p style={{ ...f(1.8), lineHeight: 1.45, color: "#444", marginTop: "0.2cqw" }}>{x.description}</p>}
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
      {eduList.map((e, ei) => (
        <div key={ei} style={{ marginTop: ei ? "2cqw" : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "2cqw" }}>
            <p style={{ ...f(2), fontWeight: 700 }}>{[e.degree, e.school].filter(Boolean).join(", ")}</p>
            {e.location && <p style={{ ...f(1.6), color: "#777", flexShrink: 0 }}>{e.location}</p>}
          </div>
          {period(e.startDate, e.endDate, e.current) && (
            <p style={{ ...f(1.7), color: "#777", marginTop: "0.3cqw" }}>{period(e.startDate, e.endDate, e.current)}</p>
          )}
          {honorsLine(e) && <p style={{ ...f(1.7), color: "#444", marginTop: "0.5cqw" }}>{honorsLine(e)}</p>}
          {e.coursework && <p style={{ ...f(1.65), lineHeight: 1.4, color: "#444", marginTop: "0.5cqw" }}>Coursework: {e.coursework}</p>}
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
      <p style={{ ...f(1.5 * sb), fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t}</p>
      {v ? <p style={{ ...f(1.8 * sb), color: "#444", wordBreak: "break-word" }}>{v}</p> : <Bars widths={["70%"]} />}
    </div>
  );

  const detailsBlock = (
    <div style={glow(active === "contact")}>
      {label("Address", d.address)}
      {label("Phone", formatContactPhone(d.phone, d.countryCode))}
      {label("Email", d.email)}
      {linksList.map((l, i) => (
        <React.Fragment key={i}>{label(l.label || "Link", displayUrl(l.url))}</React.Fragment>
      ))}
    </div>
  );

  /* ---------- CLASSIC: centered serif, gray section bands, dotted leaders ---------- */
  const classic = () => {
    const band = (t: string) => (
      <div style={{ background: "#f1f1f1", height: "3.3cqw", display: "flex", alignItems: "center", justifyContent: "center", margin: "2.4cqw 0 1.4cqw" }}>
        <span style={{ ...f(1.95), lineHeight: 1, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "0.22cqw solid #1a1a1a", paddingBottom: "0.25cqw" }}>
          {t}
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
              {name || "Your Name"}
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
          {(d.email.trim() || !d.phone.trim()) && <span>{d.email || <span style={{ color: "#cfcfcf", fontWeight: 400 }}>you@email.com</span>}</span>}
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
                  {j.description && <p style={{ ...f(1.8), lineHeight: 1.5, color: "#444", margin: "1cqw 0 0 2.4cqw", paddingRight: placeRoom(j.location) }}>• {j.description}</p>}
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
                {e.coursework && <p style={{ ...f(1.6), lineHeight: 1.4, color: "#444", margin: "0.5cqw 0 0 2.4cqw" }}>Coursework: {e.coursework}</p>}
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
                  <span style={{ fontStyle: "italic", fontWeight: 700, ...f(1.7) }}>{l.level}</span>
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
                {x.description && <p style={{ ...f(1.8), lineHeight: 1.4, color: "#444", margin: "0.2cqw 0 0 2.4cqw" }}>{x.description}</p>}
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

              </div>
            </>
          );
        })()}
        </div>
      </div>
    );
  };

  /* ---------- MODERN: huge name, rule, sidebar + main column ---------- */
  const modern = () => {
    const heading = (t: string) => (
      <div style={{ margin: "0 0 1.8cqw" }}>
        <p style={{ ...f(2.4), fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{t}</p>
        <div style={{ width: "3.4cqw", height: "0.5cqw", background: "#1a1a1a", marginTop: "0.8cqw" }} />
      </div>
    );
    return (
      <div style={{ padding: "6cqw 6cqw 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "3cqw" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ ...f((() => {
              const ps = (name || "Your Name").split(/\s+/);
              const longest = ps.length > 1 ? Math.max(ps.slice(0, -1).join(" ").length, ps[ps.length - 1].length) : ps[0].length;
              return fitName(d.photo ? 5.1 : 5.8, "x".repeat(longest), d.photo ? 68 : 86, 0.8);
            })()), fontWeight: 700, lineHeight: 1.05, letterSpacing: "0", textTransform: "uppercase", color: name ? "#1a1a1a" : "#d4d4d4", whiteSpace: "nowrap" }}>
              {(() => {
                const parts = (name || "Your Name").split(/\s+/);
                const top = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0];
                const bottom = parts.length > 1 ? parts[parts.length - 1] : "";
                return (
                  <>
                    {top}
                    {bottom && <><br />{bottom}</>}
                  </>
                );
              })()}
            </p>
            {d.jobTitle ? (
              <p style={{ ...f(1.8), color: "#555", marginTop: "2cqw", ...(active === "about" ? glow(true) : {}) }}>{d.jobTitle}</p>
            ) : (
              <div style={active === "about" ? glow(true) : undefined}><Skel w="30%" mt="2.4cqw" /></div>
            )}
          </div>
          {d.photo && <Photo src={d.photo} size={12.5} />}
        </div>
        <div style={{ borderTop: "0.2cqw solid #e2e2e2", margin: "3cqw 0" }} />
        <div ref={colsRef} style={{ display: "grid", gridTemplateColumns: "27% 1fr", columnGap: "0", alignItems: "start", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "27%", width: "0.2cqw", background: "#e2e2e2" }} />
          <div ref={leftRef} style={{ paddingRight: "3cqw", zoom: colScale.l }}>
            {heading("Details")}
            {detailsBlock}
            <div style={{ marginTop: "3.4cqw" }}>
              {heading("Skills")}
              <div style={glow(active === "skills")}>
                {d.skills.length > 0 ? (
                  d.skills.map((s) => (
                    <div key={s} style={{ marginBottom: "1.4cqw" }}>
                      <p style={{ ...f(1.8 * sb) }}>{s}</p>
                      {skillLevel(d.skillLevels, s) > 0 && (
                        <div style={{ height: "0.7cqw", background: "#d6d6d6", marginTop: "0.6cqw" }}>
                          <div style={{ height: "100%", width: `${(skillLevel(d.skillLevels, s) / 5) * 100}%`, background: "#1a1a1a" }} />
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <Bars widths={["80%", "65%"]} />
                )}
              </div>
            </div>
            {langs.length > 0 && (
              <div style={{ marginTop: "3.4cqw" }}>
                {heading("Languages")}
                <div style={glow(active === "skills")}>
                  {langs.map((l) => (
                    <div key={l.name} style={{ marginBottom: "1.4cqw" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", ...f(1.8) }}>
                        <span>{l.name}</span>
                        <span style={{ ...f(1.4), color: "#888" }}>{l.level}</span>
                      </div>
                      <div style={{ height: "0.7cqw", background: "#d6d6d6", marginTop: "0.6cqw" }}>
                        <div style={{ height: "100%", width: `${levelFraction(l.level) * 100}%`, background: "#1a1a1a" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div ref={rightRef} style={{ paddingLeft: "3.4cqw", zoom: colScale.r }}>
            {(() => {
              const parts: Record<string, React.ReactNode> = {
                about: (
                  <>
                    {heading("Profile")}
                    <div style={glow(active === "about")}>{profileBody}</div>
                  </>
                ),
                job: (
                  <>
                    {heading("Employment History")}
                    <div style={glow(active === "job")}>{jobBody}</div>
                  </>
                ),
                education: (
                  <>
                    {heading("Education")}
                    <div style={glow(active === "education")}>{eduBody}</div>
                  </>
                ),
                extras:
                  projectList.length + internList.length + certList.length === 0 ? null : (
                    <>
                      {projectList.length > 0 && (
                        <div>
                          {heading("Projects")}
                          {projectsBody}
                        </div>
                      )}
                      {internList.length > 0 && (
                        <div style={{ marginTop: projectList.length > 0 ? "3cqw" : 0 }}>
                          {heading("Internships")}
                          {renderJobs(internList)}
                        </div>
                      )}
                      {certList.length > 0 && (
                        <div style={{ marginTop: projectList.length + internList.length > 0 ? "3cqw" : 0 }}>
                          {heading("Certifications")}
                          {certsBody}
                        </div>
                      )}
                    </>
                  ),
              };
              const shown = orderedSections(d.sectionOrder, ["about", "job", "education", "extras"]).filter((id) => parts[id] !== null);
              return shown.map((id, i) => (
                <div key={id} style={i > 0 ? { borderTop: "0.2cqw solid #e2e2e2", margin: "3cqw 0 0", padding: "3cqw 0 0" } : undefined}>
                  {parts[id]}
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    );
  };

  /* ---------- CREATIVE: gray sidebar, boxed name ---------- */
  const creative = () => {
    const heading = (t: string) => (
      <p style={{ ...f(1.9), fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "0.2cqw solid #1a1a1a", paddingBottom: "0.8cqw", margin: "0 0 1.8cqw" }}>
        {t}
      </p>
    );
    return (
      <div style={{ position: "relative" }}>
        {d.photo && <Photo src={d.photo} size={14} style={{ position: "absolute", left: "5cqw", top: "5cqw" }} />}
        <div style={{ position: "relative", padding: "4.5cqw 6cqw 0" }}>
          <div style={{ border: "0.35cqw solid #1a1a1a", background: "#fff", textAlign: "center", padding: "3.4cqw 2cqw", margin: "0 18cqw 6cqw" }}>
            <p style={{ ...f(fitName(3.9, name || "Your Name", 46, 0.86)), fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: name ? "#1a1a1a" : "#d4d4d4", whiteSpace: "nowrap" }}>
              {name || "Your Name"}
            </p>
            {d.jobTitle ? (
              <p style={{ ...f(1.7), letterSpacing: "0.1em", textTransform: "uppercase", color: "#444", marginTop: "1.2cqw", ...(active === "about" ? glow(true) : {}) }}>
                {d.jobTitle}
              </p>
            ) : (
              <div style={active === "about" ? glow(true) : undefined}><Skel w="38%" center mt="1.6cqw" /></div>
            )}
          </div>
          <div ref={colsRef} style={{ display: "grid", gridTemplateColumns: "26% 1fr", columnGap: "6cqw", alignItems: "start" }}>
            <div ref={leftRef} style={{ zoom: colScale.l }}>
              {heading("Details")}
              {detailsBlock}
              <div style={{ marginTop: "3cqw" }}>
                {heading("Skills")}
                <div style={glow(active === "skills")}>
                  {d.skills.length > 0 ? (
                    d.skills.map((s) => (
                      <div key={s} style={{ marginBottom: "1.6cqw" }}>
                        <p style={f(1.8)}>{s}</p>
                        {skillLevel(d.skillLevels, s) > 0 && (
                          <p style={{ marginTop: "0.3cqw" }}><DotRow level={skillLevel(d.skillLevels, s)} /></p>
                        )}
                      </div>
                    ))
                  ) : (
                    <Bars widths={["80%", "65%"]} />
                  )}
                </div>
              </div>
              {langs.length > 0 && (
                <div style={{ marginTop: "3cqw" }}>
                  {heading("Languages")}
                  <div style={glow(active === "skills")}>
                    {langs.map((l) => (
                      <div key={l.name} style={{ marginBottom: "1.6cqw" }}>
                        <p style={f(1.8)}>{l.name}</p>
                        <p style={{ ...f(1.5), letterSpacing: "0.2em", color: "#555" }}>{levelDots(l.level)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div ref={rightRef} style={{ zoom: colScale.r }}>
              {(() => {
                const parts: Record<string, React.ReactNode> = {
                  about: (
                    <>
                      {heading("Profile")}
                      <div style={glow(active === "about")}>{profileBody}</div>
                    </>
                  ),
                  job: (
                    <>
                      {heading("Employment History")}
                      <div style={glow(active === "job")}>{jobBody}</div>
                    </>
                  ),
                  education: (
                    <>
                      {heading("Education")}
                      <div style={glow(active === "education")}>{eduBody}</div>
                    </>
                  ),
                  extras:
                    projectList.length + internList.length + certList.length === 0 ? null : (
                      <>
                        {projectList.length > 0 && (
                          <div>
                            {heading("Projects")}
                            {projectsBody}
                          </div>
                        )}
                        {internList.length > 0 && (
                          <div style={{ marginTop: projectList.length > 0 ? "3cqw" : 0 }}>
                            {heading("Internships")}
                            {renderJobs(internList)}
                          </div>
                        )}
                        {certList.length > 0 && (
                          <div style={{ marginTop: projectList.length + internList.length > 0 ? "3cqw" : 0 }}>
                            {heading("Certifications")}
                            {certsBody}
                          </div>
                        )}
                      </>
                    ),
                };
                const shown = orderedSections(d.sectionOrder, ["about", "job", "education", "extras"]).filter((id) => parts[id] !== null);
                return shown.map((id, i) => (
                  <div key={id} style={{ marginTop: i > 0 ? "3cqw" : 0 }}>
                    {parts[id]}
                  </div>
                ));
              })()}
            </div>
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
          : { maxWidth: large ? "60rem" : "max(20rem, calc((100dvh - 8rem) * 0.7727))" }
      }
    >
      {!bare && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>}
      <div className="group relative">
      <div
        ref={paper}
        role="img"
        aria-label="Preview of your resume"
        className="relative aspect-[8.5/11] w-full overflow-hidden rounded-md bg-white text-neutral-900 shadow-2xl ring-1 ring-black/10"
        style={{ containerType: "inline-size" }}
      >
        {template === "creative" && <div style={{ position: "absolute", inset: "0 auto 0 0", width: "32%", background: "#f1f1f1" }} />}
        <div ref={content} style={{ zoom: template === "modern" || template === "creative" ? 1 : scale, position: "relative" }}>
          {template === "modern" ? modern() : template === "creative" ? creative() : classic()}
        </div>
      </div>
      {onCustomize && (
        <button
          type="button"
          onClick={onCustomize}
          aria-label="Customize the look"
          title="Customize the look"
          className="absolute right-3 top-3 flex h-11 w-11 scale-90 items-center justify-center rounded-full bg-blue-600 text-white opacity-0 shadow-lg shadow-blue-900/30 transition duration-200 hover:bg-blue-700 focus-visible:scale-100 focus-visible:opacity-100 group-hover:scale-100 group-hover:opacity-100"
        >
          <Palette className="h-5 w-5" />
        </button>
      )}
      </div>
      {!bare && <p className="mt-2 text-center text-xs text-muted-foreground">A preview of the {template || "classic"} look. The final PDF may differ slightly.</p>}
    </div>
    )}
    </div>
  );
}
