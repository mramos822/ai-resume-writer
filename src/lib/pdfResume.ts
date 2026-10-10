// src/lib/pdfResume.ts
// Renders a profile into a one-page PDF with pdfkit (pure JS, so it also runs on serverless hosts like Vercel).
// The three layouts mirror the template previews in /public/templates:
//   modern   – big name, left "details / skills" column with bar underlines, thin vertical divider
//   classic  – centered serif header, grey section bands, diamond bullets with dotted leaders
//   creative – grey side panel, boxed name, ruled section titles
// Everything is drawn at a scale factor `k`; if the content does not fit on one page we retry
// with a smaller k until it does (down to MIN_SCALE, after which it flows onto a second page).
import PDFDocument from "pdfkit";
import { placeLine } from "@/lib/place";
import { orderedSections } from "@/lib/sectionOrder";
import { formatPeriod } from "@/lib/dateFormat";
import { formatContactPhone } from "@/lib/phone";
import { levelFraction } from "@/lib/languages";
import { skillLevel } from "@/lib/skillLevels";
import { displayUrl } from "@/lib/links";
import type { ProfileData, JobEntry, EducationEntry, ProjectEntry } from "@/context/profileContext";

type Doc = PDFKit.PDFDocument;

export type ResumeTemplate = "classic" | "modern" | "creative";

const W = 595.28;
const H = 841.89;
const BOTTOM = 30; // page break threshold (bottom margin)

const INK = "#1a1a1a";
const BODY = "#4a4a4a";
const MUTED = "#6b6b6b";
const HAIR = "#dcdcdc";
const PANEL = "#f1f1f1";

// fine steps so the page is filled as much as it can be without spilling onto a second one
const SCALES = Array.from({ length: 22 }, (_, i) => Math.round((1 - i * 0.02) * 100) / 100);

/** Characters the built-in PDF fonts can't draw; collected per render so the UI can warn about them. */
const droppedChars = new Set<string>();

/** Standard PDF fonts only cover Latin-1 + a few punctuation marks; replace anything else. */
function clean(value?: string): string {
  return (value ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ•…]/gu, (ch) => {
      droppedChars.add(ch);
      return "";
    })
    .trim();
}

interface Style {
  font: string;
  size: number;
  color?: string;
  spacing?: number;
  gap?: number;
  align?: "left" | "center" | "right" | "justify";
}

class Pen {
  /** Decoded profile photo, when the resume should show one. */
  photo?: Buffer;

  constructor(public doc: Doc, public k: number) {}

  /** Draw the photo as a plain circle (no border); returns false (and draws nothing) if there is no usable photo. */
  drawPhoto(cx: number, cy: number, r: number): boolean {
    if (!this.photo) return false;
    try {
      this.doc.save().circle(cx, cy, r).clip();
      this.doc.image(this.photo, cx - r, cy - r, { cover: [2 * r, 2 * r], align: "center", valign: "center" });
      this.doc.restore();
      return true;
    } catch {
      return false;
    }
  }

  private apply(s: Style) {
    this.doc.font(s.font).fontSize(s.size * this.k).fillColor(s.color ?? INK);
  }

  /** Height a piece of text would take at the given width. */
  measure(text: string, width: number, s: Style): number {
    this.apply(s);
    return this.doc.heightOfString(text, {
      width,
      lineGap: (s.gap ?? 1.5) * this.k,
      characterSpacing: (s.spacing ?? 0) * this.k,
    });
  }

  /** The style with the font size reduced (down to `min`) until the text fits on one line of `width`. */
  fit(text: string, s: Style, width: number, min: number): Style {
    let size = s.size;
    while (size > min && this.widthOf(text, { ...s, size }) > width) size -= 0.5;
    return { ...s, size };
  }

  widthOf(text: string, s: Style): number {
    this.apply(s);
    return this.doc.widthOfString(text, { characterSpacing: (s.spacing ?? 0) * this.k });
  }

  /** Draw wrapped text at (x, y) and return the y just below it. */
  text(text: string, x: number, y: number, width: number, s: Style): number {
    if (!text) return y;
    this.apply(s);
    this.doc.text(text, x, y, {
      width,
      align: s.align ?? "left",
      lineGap: (s.gap ?? 1.5) * this.k,
      characterSpacing: (s.spacing ?? 0) * this.k,
    });
    return this.doc.y;
  }

  /** One line with text on the left and text right-aligned on the same baseline. */
  leftRight(left: string, right: string, x: number, y: number, width: number, ls: Style, rs: Style): number {
    const rw = right ? this.widthOf(right, rs) : 0;
    const bottom = this.text(left, x, y, Math.max(20, width - rw - 10), ls);
    if (right) {
      this.apply(rs);
      // align the small right-hand text with the first line's baseline
      const dy = (ls.size - rs.size) * this.k * 0.18;
      this.doc.text(right, x, y + dy, { width, align: "right", lineBreak: false });
    }
    return bottom;
  }

  rule(x1: number, y: number, x2: number, color = HAIR, weight = 0.6) {
    this.doc.save().moveTo(x1, y).lineTo(x2, y).lineWidth(weight * this.k).stroke(color).restore();
  }

  rect(x: number, y: number, w: number, h: number, fill: string) {
    this.doc.save().rect(x, y, w, h).fill(fill).restore();
  }
}

/* ---------- data helpers ---------- */

const jobHeading = (j: JobEntry) => [clean(j.title), clean(j.company)].filter(Boolean).join(", ");
/** Projects are drawn like jobs: the name is the heading and the context goes under it. */
const projectAsJob = (pr: ProjectEntry): JobEntry => ({
  id: pr.id,
  title: pr.name,
  company: "",
  description: pr.description,
  startDate: pr.startDate,
  endDate: pr.endDate,
  current: pr.current,
  accomplishments: pr.accomplishments || [],
});
const projectsOf = (p: ProfileData) => (p.projects || []).filter((x) => clean(x.name)).map(projectAsJob);
const eduHeading = (e: EducationEntry) => [clean(e.degree), clean(e.school)].filter(Boolean).join(", ");
const jobDates = (j: JobEntry) => formatPeriod(j, " - ");
const eduDates = (e: EducationEntry) => formatPeriod(e, " - ");
/** "GPA: 3.8 | Dean's List" and "Coursework: ..." lines, only the ones that have content. */
const eduExtras = (e: EducationEntry) => ({
  honors: [clean(e.gpa) ? `GPA: ${clean(e.gpa)}` : "", clean(e.honors)].filter(Boolean).join("  |  "),
  coursework: clean(e.coursework) ? `Coursework: ${clean(e.coursework)}` : "",
});
/** Skills with their optional 1-5 level (0 = none: then no bar, dots or label is drawn). */
const linksOf = (p: ProfileData) => (p.links || []).map((l) => ({ label: clean(l.label), url: clean(l.url) })).filter((l) => l.url);
const certsOf = (p: ProfileData) =>
  (p.certifications || []).map((c) => ({ name: clean(c.name), issuer: clean(c.issuer), year: clean(c.year) })).filter((c) => c.name);
const skillsOf = (p: ProfileData) =>
  (p.skills || [])
    .map((raw) => ({ name: clean(raw), level: skillLevel(p.skillLevels, raw) }))
    .filter((s) => s.name);
const languagesOf = (p: ProfileData) =>
  (p.languages || []).map((l) => ({ name: clean(l.name), level: clean(l.level) })).filter((l) => l.name);
const details = (p: ProfileData) =>
  [
    { label: "Address", value: clean(placeLine(p.contactInfo)) },
    { label: "Phone", value: formatContactPhone(clean(p.contactInfo?.phone), p.contactInfo?.countryCode) },
    { label: "Email", value: clean(p.contactInfo?.email) },
    ...linksOf(p).map((l) => ({ label: l.label || "Link", value: displayUrl(l.url) })),
  ].filter((d) => d.value);

/** "Taylor Cook" -> ["TAYLOR", "COOK"]; long names wrap on the last word. */
function nameLines(name: string): string[] {
  const parts = clean(name).toUpperCase().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return [parts[0] || "YOUR NAME"];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
}

function bulletList(
  pen: Pen,
  items: string[],
  x: number,
  y: number,
  width: number,
  s: Style,
  indent = 12,
  gap = 2.5,
  bullet = "•"
): number {
  const k = pen.k;
  for (const raw of items) {
    const item = clean(raw);
    if (!item) continue;
    pen.text(bullet, x + 3 * k, y, indent, { ...s, align: "left" });
    y = pen.text(item, x + indent * k, y, width - indent * k, s) + gap * k;
  }
  return y;
}

/* ===================================================================
   MODERN
   =================================================================== */
function drawModern(pen: Pen, p: ProfileData) {
  const k = pen.k;
  const ML = 46;
  const MR = 46;
  const top = 42;
  const contentW = W - ML - MR;

  // Header (with a photo on the right, the name column gets narrower)
  const pr = pen.photo ? 32 * k : 0;
  const headW = pen.photo ? contentW - 2 * pr - 18 : contentW;
  let y = top;
  for (const line of nameLines(p.name)) {
    y = pen.text(line, ML, y, headW, pen.fit(line, { font: "Helvetica-Bold", size: 29.2, spacing: 1.05, gap: -2 }, headW, 14)) - 2 * k;
  }
  if (clean(p.jobTitle)) {
    y = pen.text(clean(p.jobTitle), ML, y + 5 * k, headW, { font: "Helvetica", size: 10.5, color: MUTED });
  }
  if (pen.photo && pen.drawPhoto(W - MR - pr, top + pr, pr)) y = Math.max(y, top + 2 * pr);
  y += 14 * k;
  pen.rule(ML, y, W - MR, HAIR, 0.8);
  const bodyTop = y + 16 * k;

  const sideW = 138;
  const gap = 26;
  const mainX = ML + sideW + gap;
  const mainW = W - MR - mainX;
  const dividerX = ML + sideW + gap / 2;

  pen.doc.save().moveTo(dividerX, y).lineTo(dividerX, H - 40).lineWidth(0.6).stroke(HAIR).restore();

  const title = (t: string, x: number, yy: number, w: number): number => {
    const bottom = pen.text(t.toUpperCase(), x, yy, w, { font: "Helvetica-Bold", size: 12.8, spacing: 1.2 });
    pen.rect(x, bottom + 3 * k, 22 * k, 2.4 * k, INK);
    return bottom + 3 * k + 2.4 * k + 10 * k;
  };

  // Left column
  let sy = bodyTop;
  const det = details(p);
  if (det.length) {
    sy = title("Details", ML, sy, sideW);
    for (const d of det) {
      sy = pen.text(d.label.toUpperCase(), ML, sy, sideW, { font: "Helvetica-Bold", size: 7, spacing: 0.4 }) + 1 * k;
      sy = pen.text(d.value, ML, sy, sideW, { font: "Helvetica", size: 8.5, color: BODY }) + 8 * k;
    }
    sy += 10 * k;
  }
  const skills = skillsOf(p);
  if (skills.length) {
    sy = title("Skills", ML, sy, sideW);
    for (const s of skills) {
      sy = pen.text(s.name, ML, sy, sideW, { font: "Helvetica", size: 8.8, color: INK }) + 3 * k;
      if (s.level) {
        pen.rect(ML, sy, sideW, 2.6 * k, "#d6d6d6");
        pen.rect(ML, sy, (sideW * s.level) / 5, 2.6 * k, INK);
        sy += 2.6 * k;
      }
      sy += 8 * k;
    }
  }
  const langs = languagesOf(p);
  if (langs.length) {
    sy += 10 * k;
    sy = title("Languages", ML, sy, sideW);
    for (const l of langs) {
      sy = pen.leftRight(l.name, l.level, ML, sy, sideW, { font: "Helvetica", size: 8.8, color: INK }, { font: "Helvetica", size: 7, color: MUTED }) + 3 * k;
      pen.rect(ML, sy, sideW, 2.6 * k, "#d6d6d6");
      pen.rect(ML, sy, sideW * levelFraction(l.level), 2.6 * k, INK);
      sy += 2.6 * k + 8 * k;
    }
  }

  // Right column
  let my = bodyTop;
  const section = (t: string) => {
    if (my > bodyTop) {
      my += 4 * k;
      pen.rule(mainX, my, W - MR, HAIR, 0.6);
      my += 14 * k;
    }
    my = title(t, mainX, my, mainW);
  };


  // `tight` is for projects: the dates sit on the title row and the context goes right under the title
  const jobs = (list: JobEntry[], tight = false) => {
    for (const j of list) {
      my = pen.leftRight(jobHeading(j), tight ? jobDates(j) : clean(j.location), mainX, my, mainW, { font: "Helvetica-Bold", size: 10, gap: 1 }, { font: "Helvetica", size: 8, color: MUTED });
      const dates = tight ? "" : jobDates(j);
      if (dates) my = pen.text(dates, mainX, my + 2 * k, mainW, { font: "Helvetica", size: 8, color: MUTED });
      my += (tight ? 1.5 : 5) * k;
      if (clean(j.description)) {
        my = pen.text(clean(j.description), mainX, my, mainW, { font: "Helvetica", size: 8.5, color: BODY, gap: 1.8 }) + 3 * k;
      }
      my = bulletList(pen, j.accomplishments || [], mainX, my, mainW, { font: "Helvetica", size: 8.5, color: BODY, gap: 1.8 }, 12, 3);
      my += 7 * k;
    }
  };

  // Each section is drawn by its own function, so the order can follow the person's choice
  const secs: Record<string, () => void> = {
    about: () => {
    if (clean(p.careerObjective)) {
      section("Profile");
      my = pen.text(clean(p.careerObjective), mainX, my, mainW, { font: "Helvetica", size: 8.8, color: BODY, gap: 2 }) + 6 * k;
    }
    },
    job: () => {
    if (p.jobHistory?.length) {
      section("Employment History");
      jobs(p.jobHistory);
    }
    },
    education: () => {
    if (p.education?.length) {
      section("Education");
      for (const e of p.education) {
        my = pen.leftRight(eduHeading(e), clean(e.location), mainX, my, mainW, { font: "Helvetica-Bold", size: 10, gap: 1 }, { font: "Helvetica", size: 8, color: MUTED });
        const dates = eduDates(e);
        if (dates) my = pen.text(dates, mainX, my + 2 * k, mainW, { font: "Helvetica", size: 8, color: MUTED });
        const extra = eduExtras(e);
        if (extra.honors) my = pen.text(extra.honors, mainX, my + 2 * k, mainW, { font: "Helvetica", size: 8, color: BODY });
        if (extra.coursework) my = pen.text(extra.coursework, mainX, my + 2 * k, mainW, { font: "Helvetica", size: 8, color: BODY, gap: 1.6 });
        my += 9 * k;
      }
    }
    },
    extras: () => {
    if (p.internships?.length) {
      section("Internships");
      jobs(p.internships);
    }
    if (projectsOf(p).length) {
      section("Projects");
      jobs(projectsOf(p), true);
    }
    const certs = certsOf(p);
    if (certs.length) {
      section("Certifications");
      for (const c of certs) {
        my = pen.leftRight(c.name, c.year, mainX, my, mainW, { font: "Helvetica-Bold", size: 9.6, gap: 1 }, { font: "Helvetica", size: 8, color: MUTED });
        if (c.issuer) my = pen.text(c.issuer, mainX, my + 1 * k, mainW, { font: "Helvetica", size: 8.2, color: BODY });
        my += 7 * k;
      }
    }

    },
  };
  for (const id of orderedSections(p.sectionOrder, ["about", "job", "education", "extras"])) secs[id]?.();
}

/* ===================================================================
   CLASSIC
   =================================================================== */
/** Five-point star centered on (cx, cy); filled or just outlined. */
function star(pen: Pen, cx: number, cy: number, r: number, filled: boolean) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.42;
    pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  const doc = pen.doc.save().polygon(...pts);
  if (filled) doc.fill(INK);
  else doc.lineWidth(0.5 * pen.k).stroke(INK);
  doc.restore();
}

function diamond(pen: Pen, x: number, y: number) {
  const s = 3.4 * pen.k;
  pen.doc.save().polygon([x + s, y], [x + 2 * s, y + s], [x + s, y + 2 * s], [x, y + s]).fill(INK).restore();
}

/** Dotted leader between the end of a heading and the right-hand date. */
function leader(pen: Pen, x1: number, x2: number, y: number) {
  if (x2 - x1 < 12) return;
  pen.doc
    .save()
    .moveTo(x1, y)
    .lineTo(x2, y)
    .lineWidth(0.7 * pen.k)
    .dash(0.7 * pen.k, { space: 2.2 * pen.k })
    .stroke("#8a8a8a")
    .undash()
    .restore();
}

function drawClassic(pen: Pen, p: ProfileData) {
  const k = pen.k;
  const ML = 46;
  const MR = 46;
  const cw = W - ML - MR;
  const c = p.contactInfo;

  // Header: with a photo it sits on the left and the centered text keeps the page centered
  const pr = pen.photo ? 28 * k : 0;
  const hx = pen.photo ? ML + 2 * pr + 14 : ML;
  const hw = pen.photo ? cw - 2 * (2 * pr + 14) : cw;
  let y = 40;
  const classicName = clean(p.name).toUpperCase() || "YOUR NAME";
  y = pen.text(classicName, hx, y, hw, pen.fit(classicName, { font: "Times-Bold", size: 21, spacing: 2, align: "center" }, hw, 11));
  if (clean(p.jobTitle)) {
    y = pen.text(clean(p.jobTitle), hx, y + 3 * k, hw, { font: "Times-Roman", size: 11, align: "center" });
  }
  if (clean(placeLine(c))) {
    y = pen.text(clean(placeLine(c)), hx, y + 4 * k, hw, { font: "Times-Roman", size: 9.5, color: BODY, align: "center" });
  }
  const linkLine = linksOf(p).map((l) => displayUrl(l.url)).join("  ·  ");
  if (linkLine) y = pen.text(linkLine, hx, y + 3 * k, hw, { font: "Times-Roman", size: 9, color: BODY, align: "center" });
  if (pen.photo && pen.drawPhoto(ML + pr, 40 + pr, pr)) y = Math.max(y, 40 + 2 * pr);
  y += 10 * k;
  if (clean(c?.phone) || clean(c?.email)) {
    const ls: Style = { font: "Times-Roman", size: 11 }; // same size as the job title above
    const ph = formatContactPhone(clean(c?.phone), c?.countryCode);
    const em = clean(c?.email);
    // with only one of them, it goes in the middle
    if (ph && em) pen.leftRight(ph, em, ML, y, cw, ls, ls);
    else pen.text(ph || em, ML, y, cw, { ...ls, align: "center" });
    y += 12 * k;
  }
  pen.rule(ML, y, W - MR, INK, 1.5);
  pen.rule(ML, y + 3.6 * k, W - MR, INK, 0.5);
  y += 12 * k;

  const band = (t: string) => {
    y += 4 * k;
    const bh = 19 * k;
    pen.rect(ML, y, cw, bh, PANEL);
    const tw = pen.widthOf(t.toUpperCase(), { font: "Times-Bold", size: 11, spacing: 1.4 });
    pen.text(t.toUpperCase(), ML, y + 4.6 * k, cw, { font: "Times-Bold", size: 11, spacing: 1.4, align: "center" });
    const ux = ML + (cw - tw) / 2;
    pen.rule(ux, y + bh - 3.5 * k, ux + tw, INK, 0.8);
    y += bh + 8 * k;
  };

  const entryRow = (heading: string, dates: string) => {
    const top = y;
    diamond(pen, ML + 2 * k, top + 3 * k);
    const hx = ML + 16 * k;
    const hs: Style = { font: "Times-Bold", size: 10.5 };
    const ds: Style = { font: "Times-Roman", size: 8.5, color: BODY };
    const dw = dates ? pen.widthOf(dates, ds) : 0;
    const hw = pen.widthOf(heading, hs);
    const bottom = pen.leftRight(heading, dates, hx, top, W - MR - hx, hs, ds);
    if (dates && hw < W - MR - hx - dw - 30) leader(pen, hx + hw + 6, W - MR - dw - 6, top + 8.6 * k);
    y = bottom;
  };

  const bulletStyle: Style = { font: "Times-Roman", size: 9.5, color: INK, gap: 1.6 };


  // `tight` is for projects: the context goes right under the title
  const jobs = (list: JobEntry[], tight = false) => {
    for (const j of list) {
      entryRow(jobHeading(j), jobDates(j));
      y += (tight ? 0.5 : 3) * k;
      // like the template: the place sits small and right-aligned beside the first line of text.
      // It takes no space, so the text below is laid out exactly as if there were no location.
      const locStyle: Style = { font: "Times-Roman", size: 8, color: MUTED, align: "right" };
      const loc = clean(j.location);
      if (loc) pen.text(loc, ML, y, cw, locStyle);
      // the first block of text is narrower by the width of the place, so a long line never runs under it
      let reserve = loc ? pen.widthOf(loc, locStyle) + 8 * k : 0;
      if (clean(j.description)) {
        y = pen.text(clean(j.description), ML + 16 * k, y, cw - 16 * k - reserve, { ...bulletStyle, color: BODY }) + 2 * k;
        reserve = 0;
      }
      const bl = (j.accomplishments || []).filter((b) => clean(b));
      if (reserve && bl.length) {
        y = bulletList(pen, [bl[0]], ML + 16 * k, y, cw - 16 * k - reserve, bulletStyle, 11, 2);
        y = bulletList(pen, bl.slice(1), ML + 16 * k, y, cw - 16 * k, bulletStyle, 11, 2);
      } else {
        y = bulletList(pen, bl, ML + 16 * k, y, cw - 16 * k, bulletStyle, 11, 2);
      }
      y += 6 * k;
    }
  };

  // Each section is drawn by its own function, so the order can follow the person's choice
  const secs: Record<string, () => void> = {
    about: () => {
    if (clean(p.careerObjective)) {
      band("Profile");
      y = pen.text(clean(p.careerObjective), ML + 10 * k, y, cw - 20 * k, { font: "Times-Roman", size: 9.5, color: INK, gap: 2, align: "center" }) + 8 * k;
    }
    },
    job: () => {
    if (p.jobHistory?.length) {
      band("Employment History");
      jobs(p.jobHistory);
    }
    },
    education: () => {
    if (p.education?.length) {
      band("Education");
      for (const e of p.education) {
        entryRow(clean(e.school) || eduHeading(e), eduDates(e));
        // the place sits beside the first line below, takes no space (same as for jobs)
        const eLocStyle: Style = { font: "Times-Roman", size: 8, color: MUTED, align: "right" };
        const eLoc = clean(e.location);
        if (eLoc) pen.text(eLoc, ML, y + 1 * k, cw, eLocStyle);
        const eReserve = eLoc ? pen.widthOf(eLoc, eLocStyle) + 8 * k : 0;
        const sub = clean(e.school) ? clean(e.degree) : "";
        if (sub) y = pen.text(sub, ML + 16 * k, y + 1 * k, cw - 16 * k - eReserve, { font: "Times-Italic", size: 9, color: BODY });
        const extra = eduExtras(e);
        if (extra.honors) y = pen.text(extra.honors, ML + 16 * k, y + 1 * k, cw - 16 * k, { font: "Times-Roman", size: 9, color: BODY });
        if (extra.coursework) y = pen.text(extra.coursework, ML + 16 * k, y + 1 * k, cw - 16 * k, { font: "Times-Roman", size: 8.5, color: BODY, gap: 1.4 });
        y += 7 * k;
      }
    }
    },
    skills: () => {
    const skills = skillsOf(p);
    if (skills.length) {
      band("Skills");
      const colW = (cw - 20 * k) / 2;
      const perCol = Math.ceil(skills.length / 2);
      const startY = y;
      let maxY = y;
      for (let col = 0; col < 2; col++) {
        let cy = startY;
        for (const s of skills.slice(col * perCol, (col + 1) * perCol)) {
          const x = ML + 4 * k + col * (colW + 20 * k);
          const ls: Style = { font: "Times-Roman", size: 9.5 };
          if (s.level) {
            // five stars on the right, filled up to the level, with the dotted line running up to them
            const sr = 3.1 * k;
            const sGap = 1.4 * k;
            const starsW = 5 * 2 * sr + 4 * sGap;
            leader(pen, x + pen.widthOf(s.name, ls) + 6, x + colW - starsW - 6, cy + 8.2 * k);
            for (let i = 0; i < 5; i++) star(pen, x + colW - starsW + sr + i * (2 * sr + sGap), cy + 4.7 * k, sr, i < s.level);
            cy = pen.text(s.name, x, cy, colW, ls) + 3 * k;
          } else {
            cy = pen.text(s.name, x, cy, colW, ls) + 3 * k;
          }
        }
        maxY = Math.max(maxY, cy);
      }
      y = maxY + 4 * k;
    }
    const langs = languagesOf(p);
    if (langs.length) {
      band("Languages");
      const colW = (cw - 20 * k) / 2;
      const perCol = Math.ceil(langs.length / 2);
      const startY = y;
      let maxY = y;
      const rs: Style = { font: "Times-BoldItalic", size: 9, color: INK };
      for (let col = 0; col < 2; col++) {
        let cy = startY;
        const x = ML + 4 * k + col * (colW + 20 * k);
        for (const l of langs.slice(col * perCol, (col + 1) * perCol)) {
          const ls: Style = { font: "Times-Roman", size: 9.5 };
          const lw = pen.widthOf(l.name, ls);
          const rw = pen.widthOf(l.level, rs);
          leader(pen, x + lw + 6, x + colW - rw - 6, cy + 8.2 * k);
          cy = pen.leftRight(l.name, l.level, x, cy, colW, ls, rs) + 3 * k;
        }
        maxY = Math.max(maxY, cy);
      }
      y = maxY + 4 * k;
    }
    },
    extras: () => {
    if (projectsOf(p).length) {
      band("Projects");
      jobs(projectsOf(p), true);
    }
    if (p.internships?.length) {
      band("Internships");
      jobs(p.internships);
    }
    const certs = certsOf(p);
    if (certs.length) {
      band("Certifications");
      for (const c of certs) {
        entryRow(c.name, c.year);
        if (c.issuer) y = pen.text(c.issuer, ML + 16 * k, y + 1 * k, cw - 16 * k, { font: "Times-Italic", size: 9, color: BODY });
        y += 5 * k;
      }
    }

    },
  };
  for (const id of orderedSections(p.sectionOrder, ["about", "job", "education", "skills", "extras"])) secs[id]?.();
}

/* ===================================================================
   CREATIVE
   =================================================================== */
const PANEL_W = 184;

function drawCreativePanel(doc: Doc) {
  doc.save().rect(0, 0, PANEL_W, H).fill(PANEL).restore();
}

function drawCreative(pen: Pen, p: ProfileData) {
  const k = pen.k;
  const RM = 40;
  const leftX = 26;
  const leftW = PANEL_W - leftX - 20;
  const mainX = PANEL_W + 26;
  const mainW = W - RM - mainX;

  // Boxed name: always centered on the page. With a photo, the photo sits in the grey panel, level with the box.
  const photoR = pen.photo ? 30 * k : 0;
  const boxW = 292;
  const boxX = (W - boxW) / 2;
  const boxY = 36;
  const boxH = (clean(p.jobTitle) ? 74 : 58) * k;
  if (pen.photo) pen.drawPhoto(boxX / 2, boxY + boxH / 2, Math.min(photoR, boxX / 2 - 8));
  pen.doc.save().rect(boxX, boxY, boxW, boxH).lineWidth(1.4).fillAndStroke("#ffffff", INK).restore();
  const nm = clean(p.name).toUpperCase() || "YOUR NAME";
  const nameStyle: Style = pen.fit(nm, { font: "Helvetica-Bold", size: 17, spacing: 2, align: "center" }, boxW - 24, 9);
  const nameH = pen.measure(nm, boxW - 24, nameStyle);
  const titleH = clean(p.jobTitle) ? 14 * k : 0;
  const ny = boxY + (boxH - nameH - titleH) / 2;
  const nb = pen.text(nm, boxX + 12, ny, boxW - 24, nameStyle);
  if (clean(p.jobTitle)) {
    pen.text(clean(p.jobTitle).toUpperCase(), boxX + 12, nb + 4 * k, boxW - 24, { font: "Helvetica", size: 8.5, spacing: 1, color: BODY, align: "center" });
  }

  const bodyTop = boxY + boxH + 30 * k;

  const title = (t: string, x: number, yy: number, w: number): number => {
    const bottom = pen.text(t.toUpperCase(), x, yy, w, { font: "Helvetica-Bold", size: 9.5, spacing: 1 });
    pen.rule(x, bottom + 3 * k, x + w, INK, 0.9);
    return bottom + 3 * k + 9 * k;
  };

  // Left column
  let sy = bodyTop;
  const det = details(p);
  if (det.length) {
    sy = title("Details", leftX, sy, leftW);
    for (const d of det) {
      sy = pen.text(d.label.toUpperCase(), leftX, sy, leftW, { font: "Helvetica-Bold", size: 6.5, spacing: 0.4 }) + 1 * k;
      sy = pen.text(d.value, leftX, sy, leftW, { font: "Helvetica", size: 7.8, color: BODY }) + 7 * k;
    }
    sy += 12 * k;
  }
  const skills = skillsOf(p);
  if (skills.length) {
    sy = title("Skills", leftX, sy, leftW);
    for (const s of skills) {
      sy = pen.text(s.name, leftX, sy, leftW, { font: "Helvetica", size: 8.4 });
      if (s.level) {
        // five small dots, filled up to the level (the built-in fonts have no round bullet glyph, so they are drawn)
        const r = 1.7 * k;
        const dotY = sy + 3.2 * k + r;
        for (let i = 0; i < 5; i++) {
          const cx = leftX + r + i * (2 * r + 2.6 * k);
          if (i < s.level) pen.doc.save().circle(cx, dotY, r).fill(INK).restore();
          else pen.doc.save().circle(cx, dotY, r - 0.3 * k).lineWidth(0.6 * k).stroke(INK).restore();
        }
        sy = dotY + r;
      }
      sy += 6 * k;
    }
  }
  const langs = languagesOf(p);
  if (langs.length) {
    sy += 12 * k;
    sy = title("Languages", leftX, sy, leftW);
    for (const l of langs) {
      sy = pen.text(l.name, leftX, sy, leftW, { font: "Helvetica", size: 8.4 });
      if (l.level) sy = pen.text(l.level, leftX, sy + 1 * k, leftW, { font: "Helvetica", size: 7.2, color: MUTED });
      sy += 6 * k;
    }
  }

  // Right column
  let my = bodyTop;
  const section = (t: string) => {
    if (my > bodyTop) my += 6 * k;
    my = title(t, mainX, my, mainW);
  };


  const jobs = (list: JobEntry[], tight = false) => {
    for (const j of list) {
      my = pen.leftRight(jobHeading(j), tight ? jobDates(j) : clean(j.location), mainX, my, mainW, { font: "Helvetica-Bold", size: 9.6, gap: 1 }, { font: "Helvetica", size: 7.8, color: MUTED });
      const dates = tight ? "" : jobDates(j);
      if (dates) my = pen.text(dates, mainX, my + 1.5 * k, mainW, { font: "Helvetica", size: 7.8, color: MUTED });
      my += (tight ? 1.5 : 4) * k;
      if (clean(j.description)) {
        my = pen.text(clean(j.description), mainX, my, mainW, { font: "Helvetica", size: 8.2, color: BODY, gap: 1.8 }) + 3 * k;
      }
      my = bulletList(pen, j.accomplishments || [], mainX, my, mainW, { font: "Helvetica", size: 8.2, color: BODY, gap: 1.8 }, 12, 2.6);
      my += 7 * k;
    }
  };

  // Each section is drawn by its own function, so the order can follow the person's choice
  const secs: Record<string, () => void> = {
    about: () => {
    if (clean(p.careerObjective)) {
      section("Profile");
      my = pen.text(clean(p.careerObjective), mainX, my, mainW, { font: "Helvetica", size: 8.5, color: BODY, gap: 2 }) + 8 * k;
    }
    },
    job: () => {
    if (p.jobHistory?.length) {
      section("Employment History");
      jobs(p.jobHistory);
    }
    },
    education: () => {
    if (p.education?.length) {
      section("Education");
      for (const e of p.education) {
        my = pen.leftRight(eduHeading(e), clean(e.location), mainX, my, mainW, { font: "Helvetica-Bold", size: 9.6, gap: 1 }, { font: "Helvetica", size: 7.8, color: MUTED });
        const dates = eduDates(e);
        if (dates) my = pen.text(dates, mainX, my + 1.5 * k, mainW, { font: "Helvetica", size: 7.8, color: MUTED });
        const extra = eduExtras(e);
        if (extra.honors) my = pen.text(extra.honors, mainX, my + 1.5 * k, mainW, { font: "Helvetica", size: 7.8, color: BODY });
        if (extra.coursework) my = pen.text(extra.coursework, mainX, my + 1.5 * k, mainW, { font: "Helvetica", size: 7.8, color: BODY, gap: 1.5 });
        my += 8 * k;
      }
    }
    },
    extras: () => {
    if (p.internships?.length) {
      section("Internships");
      jobs(p.internships);
    }
    if (projectsOf(p).length) {
      section("Projects");
      jobs(projectsOf(p), true);
    }
    const certs = certsOf(p);
    if (certs.length) {
      section("Certifications");
      for (const c of certs) {
        my = pen.leftRight(c.name, c.year, mainX, my, mainW, { font: "Helvetica-Bold", size: 9.2, gap: 1 }, { font: "Helvetica", size: 7.8, color: MUTED });
        if (c.issuer) my = pen.text(c.issuer, mainX, my + 1 * k, mainW, { font: "Helvetica", size: 8, color: BODY });
        my += 6 * k;
      }
    }

    },
  };
  for (const id of orderedSections(p.sectionOrder, ["about", "job", "education", "extras"])) secs[id]?.();
}

/* ===================================================================
   Driver
   =================================================================== */
interface Result {
  buffer: Buffer;
  pages: number;
  scale: number;
  dropped: string[];
}

/** What the caller needs to know about how the resume was fitted onto the page. */
export interface ResumeRender {
  buffer: Buffer;
  /** 1 = normal size; lower means the text was shrunk to fit one page. */
  scale: number;
  /** Number of pages in the PDF (1 unless the content was extremely long). */
  pages: number;
  /** Characters that can't be drawn with the built-in fonts and were left out. */
  droppedChars: string[];
}

/** Turns the stored "data:image/...;base64,..." string into bytes pdfkit can embed (JPEG or PNG only). */
function decodePhoto(photo?: string): Buffer | undefined {
  const m = /^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/.exec(photo ?? "");
  return m ? Buffer.from(m[2], "base64") : undefined;
}

function render(profile: ProfileData, template: ResumeTemplate, k: number, photo?: Buffer): Promise<Result> {
  droppedChars.clear();
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 0, left: 0, right: 0, bottom: BOTTOM },
    bufferPages: true,
    info: { Title: clean(profile.name) || "Resume", Author: clean(profile.name) || "Resume" },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  if (template === "creative") {
    drawCreativePanel(doc);
    doc.on("pageAdded", () => drawCreativePanel(doc));
  }

  const pen = new Pen(doc, k);
  pen.photo = photo;
  if (template === "modern") drawModern(pen, profile);
  else if (template === "creative") drawCreative(pen, profile);
  else drawClassic(pen, profile);

  const pages = doc.bufferedPageRange().count;
  const dropped = Array.from(droppedChars);
  doc.flushPages();
  doc.end();
  return finished.then((buffer) => ({ buffer, pages, scale: k, dropped }));
}

export async function renderResumeDetailed(
  profile: ProfileData,
  template: string,
  options: { withPhoto?: boolean } = {}
): Promise<ResumeRender> {
  const photo = options.withPhoto === false ? undefined : decodePhoto(profile.photo);
  const t: ResumeTemplate = template === "modern" || template === "creative" ? template : "classic";
  let last: Result | null = null;
  for (const k of SCALES) {
    last = await render(profile, t, k, photo);
    if (last.pages <= 1) break; // fits on one page
  }
  return { buffer: last!.buffer, scale: last!.scale, pages: last!.pages, droppedChars: last!.dropped };
}

export async function renderResumePdf(profile: ProfileData, template: string): Promise<Buffer> {
  return (await renderResumeDetailed(profile, template)).buffer;
}
