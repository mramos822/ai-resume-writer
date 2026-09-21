// src/lib/pdfResume.ts
// Renders a profile into a one-page PDF with pdfkit (pure JS, so it also runs on serverless hosts like Vercel).
// The three layouts mirror the template previews in /public/templates:
//   modern   – big name, left "details / skills" column with bar underlines, thin vertical divider
//   classic  – centered serif header, grey section bands, diamond bullets with dotted leaders
//   creative – grey side panel, boxed name, ruled section titles
// Everything is drawn at a scale factor `k`; if the content does not fit on one page we retry
// with a smaller k until it does (down to MIN_SCALE, after which it flows onto a second page).
import PDFDocument from "pdfkit";
import { formatPeriod } from "@/lib/dateFormat";
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

const SCALES = [1, 0.95, 0.9, 0.86, 0.82, 0.78, 0.74, 0.7, 0.66, 0.62, 0.58];

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
  constructor(public doc: Doc, public k: number) {}

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
/** Projects are drawn like jobs: the name is the heading, the tools line goes into the description. */
const projectAsJob = (pr: ProjectEntry): JobEntry => ({
  id: pr.id,
  title: pr.name,
  company: "",
  description: [pr.description, pr.technologies?.length ? `Built with ${pr.technologies.join(", ")}.` : ""]
    .filter(Boolean)
    .join(" "),
  startDate: pr.startDate,
  endDate: pr.endDate,
  current: pr.current,
  accomplishments: pr.accomplishments || [],
});
const projectsOf = (p: ProfileData) => (p.projects || []).filter((x) => clean(x.name)).map(projectAsJob);
const eduHeading = (e: EducationEntry) => [clean(e.degree), clean(e.school)].filter(Boolean).join(", ");
const jobDates = (j: JobEntry) => formatPeriod(j, " - ");
const eduDates = (e: EducationEntry) => formatPeriod(e, " - ");
const skillsOf = (p: ProfileData) => (p.skills || []).map(clean).filter(Boolean);
const details = (p: ProfileData) =>
  [
    { label: "Address", value: clean(p.contactInfo?.address) },
    { label: "Phone", value: clean(p.contactInfo?.phone) },
    { label: "Email", value: clean(p.contactInfo?.email) },
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

  // Header
  let y = top;
  for (const line of nameLines(p.name)) {
    y = pen.text(line, ML, y, contentW, { font: "Helvetica-Bold", size: 33, spacing: 1.2, gap: -2 }) - 2 * k;
  }
  if (clean(p.jobTitle)) {
    y = pen.text(clean(p.jobTitle), ML, y + 5 * k, contentW, { font: "Helvetica", size: 10.5, color: MUTED });
  }
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
    const bottom = pen.text(t.toUpperCase(), x, yy, w, { font: "Helvetica-Bold", size: 12, spacing: 1.2 });
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
      sy = pen.text(s, ML, sy, sideW, { font: "Helvetica", size: 8.8, color: INK }) + 3 * k;
      pen.rect(ML, sy, sideW, 2.6 * k, INK);
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

  if (clean(p.careerObjective)) {
    section("Profile");
    my = pen.text(clean(p.careerObjective), mainX, my, mainW, { font: "Helvetica", size: 8.8, color: BODY, gap: 2 }) + 6 * k;
  }

  const jobs = (list: JobEntry[]) => {
    for (const j of list) {
      my = pen.text(jobHeading(j), mainX, my, mainW, { font: "Helvetica-Bold", size: 10, gap: 1 });
      const dates = jobDates(j);
      if (dates) my = pen.text(dates, mainX, my + 2 * k, mainW, { font: "Helvetica", size: 8, color: MUTED });
      my += 5 * k;
      if (clean(j.description)) {
        my = pen.text(clean(j.description), mainX, my, mainW, { font: "Helvetica", size: 8.5, color: BODY, gap: 1.8 }) + 3 * k;
      }
      my = bulletList(pen, j.accomplishments || [], mainX, my, mainW, { font: "Helvetica", size: 8.5, color: BODY, gap: 1.8 }, 12, 3);
      my += 7 * k;
    }
  };

  if (p.jobHistory?.length) {
    section("Employment History");
    jobs(p.jobHistory);
  }
  if (p.internships?.length) {
    section("Internships");
    jobs(p.internships);
  }
  if (projectsOf(p).length) {
    section("Projects");
    jobs(projectsOf(p));
  }
  if (p.education?.length) {
    section("Education");
    for (const e of p.education) {
      my = pen.text(eduHeading(e), mainX, my, mainW, { font: "Helvetica-Bold", size: 10, gap: 1 });
      const dates = eduDates(e);
      if (dates) my = pen.text(dates, mainX, my + 2 * k, mainW, { font: "Helvetica", size: 8, color: MUTED });
      if (clean(e.gpa)) my = pen.text(`GPA: ${clean(e.gpa)}`, mainX, my + 1 * k, mainW, { font: "Helvetica", size: 8, color: MUTED });
      my += 9 * k;
    }
  }
}

/* ===================================================================
   CLASSIC
   =================================================================== */
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

  // Header
  let y = 40;
  y = pen.text(clean(p.name).toUpperCase() || "YOUR NAME", ML, y, cw, { font: "Times-Bold", size: 24, spacing: 2, align: "center" });
  if (clean(p.jobTitle)) {
    y = pen.text(clean(p.jobTitle), ML, y + 3 * k, cw, { font: "Times-Bold", size: 11, align: "center" });
  }
  if (clean(c?.address)) {
    y = pen.text(clean(c.address), ML, y + 4 * k, cw, { font: "Times-Roman", size: 9.5, color: BODY, align: "center" });
  }
  y += 10 * k;
  if (clean(c?.phone) || clean(c?.email)) {
    const ls: Style = { font: "Times-Bold", size: 10 };
    pen.leftRight(clean(c?.phone), clean(c?.email), ML, y, cw, ls, ls);
    y += 16 * k;
  }
  pen.rule(ML, y, W - MR, INK, 1.4);
  pen.rule(ML, y + 3.2 * k, W - MR, INK, 0.5);
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

  if (clean(p.careerObjective)) {
    band("Profile");
    y = pen.text(clean(p.careerObjective), ML + 10 * k, y, cw - 20 * k, { font: "Times-Roman", size: 9.5, color: INK, gap: 2, align: "center" }) + 8 * k;
  }

  const jobs = (list: JobEntry[]) => {
    for (const j of list) {
      entryRow(jobHeading(j), jobDates(j));
      y += 3 * k;
      if (clean(j.description)) {
        y = pen.text(clean(j.description), ML + 16 * k, y, cw - 16 * k, { ...bulletStyle, color: BODY }) + 2 * k;
      }
      y = bulletList(pen, j.accomplishments || [], ML + 16 * k, y, cw - 16 * k, bulletStyle, 11, 2);
      y += 6 * k;
    }
  };

  if (p.jobHistory?.length) {
    band("Employment History");
    jobs(p.jobHistory);
  }
  if (p.education?.length) {
    band("Education");
    for (const e of p.education) {
      entryRow(clean(e.school) || eduHeading(e), eduDates(e));
      const sub = [clean(e.degree), clean(e.gpa) ? `GPA: ${clean(e.gpa)}` : ""].filter(Boolean).join("  |  ");
      if (sub && clean(e.school)) {
        y = pen.text(sub, ML + 16 * k, y + 1 * k, cw - 16 * k, { font: "Times-Italic", size: 9, color: BODY });
      }
      y += 7 * k;
    }
  }
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
        cy = pen.text(s, ML + 4 * k + col * (colW + 20 * k), cy, colW, { font: "Times-Roman", size: 9.5 }) + 3 * k;
      }
      maxY = Math.max(maxY, cy);
    }
    y = maxY + 4 * k;
  }
  if (projectsOf(p).length) {
    band("Projects");
    jobs(projectsOf(p));
  }
  if (p.internships?.length) {
    band("Internships");
    jobs(p.internships);
  }
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

  // Boxed name
  const boxW = 292;
  const boxX = (W - boxW) / 2;
  const boxY = 36;
  const boxH = (clean(p.jobTitle) ? 74 : 58) * k;
  pen.doc.save().rect(boxX, boxY, boxW, boxH).lineWidth(1.4).fillAndStroke("#ffffff", INK).restore();
  const nameStyle: Style = { font: "Helvetica-Bold", size: 17, spacing: 2, align: "center" };
  const nm = clean(p.name).toUpperCase() || "YOUR NAME";
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
      sy = pen.text(s, leftX, sy, leftW, { font: "Helvetica", size: 8.4 }) + 6 * k;
    }
  }

  // Right column
  let my = bodyTop;
  const section = (t: string) => {
    if (my > bodyTop) my += 6 * k;
    my = title(t, mainX, my, mainW);
  };

  if (clean(p.careerObjective)) {
    section("Profile");
    my = pen.text(clean(p.careerObjective), mainX, my, mainW, { font: "Helvetica", size: 8.5, color: BODY, gap: 2 }) + 8 * k;
  }

  const jobs = (list: JobEntry[]) => {
    for (const j of list) {
      my = pen.text(jobHeading(j), mainX, my, mainW, { font: "Helvetica-Bold", size: 9.6, gap: 1 });
      const dates = jobDates(j);
      if (dates) my = pen.text(dates, mainX, my + 1.5 * k, mainW, { font: "Helvetica", size: 7.8, color: MUTED });
      my += 4 * k;
      if (clean(j.description)) {
        my = pen.text(clean(j.description), mainX, my, mainW, { font: "Helvetica", size: 8.2, color: BODY, gap: 1.8 }) + 3 * k;
      }
      my = bulletList(pen, j.accomplishments || [], mainX, my, mainW, { font: "Helvetica", size: 8.2, color: BODY, gap: 1.8 }, 12, 2.6);
      my += 7 * k;
    }
  };

  if (p.jobHistory?.length) {
    section("Employment History");
    jobs(p.jobHistory);
  }
  if (p.internships?.length) {
    section("Internships");
    jobs(p.internships);
  }
  if (projectsOf(p).length) {
    section("Projects");
    jobs(projectsOf(p));
  }
  if (p.education?.length) {
    section("Education");
    for (const e of p.education) {
      my = pen.text(eduHeading(e), mainX, my, mainW, { font: "Helvetica-Bold", size: 9.6, gap: 1 });
      const dates = eduDates(e);
      if (dates) my = pen.text(dates, mainX, my + 1.5 * k, mainW, { font: "Helvetica", size: 7.8, color: MUTED });
      if (clean(e.gpa)) my = pen.text(`GPA: ${clean(e.gpa)}`, mainX, my + 1 * k, mainW, { font: "Helvetica", size: 7.8, color: MUTED });
      my += 8 * k;
    }
  }
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

function render(profile: ProfileData, template: ResumeTemplate, k: number): Promise<Result> {
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
  if (template === "modern") drawModern(pen, profile);
  else if (template === "creative") drawCreative(pen, profile);
  else drawClassic(pen, profile);

  const pages = doc.bufferedPageRange().count;
  const dropped = Array.from(droppedChars);
  doc.flushPages();
  doc.end();
  return finished.then((buffer) => ({ buffer, pages, scale: k, dropped }));
}

export async function renderResumeDetailed(profile: ProfileData, template: string): Promise<ResumeRender> {
  const t: ResumeTemplate = template === "modern" || template === "creative" ? template : "classic";
  let last: Result | null = null;
  for (const k of SCALES) {
    last = await render(profile, t, k);
    if (last.pages <= 1) break; // fits on one page
  }
  return { buffer: last!.buffer, scale: last!.scale, pages: last!.pages, droppedChars: last!.dropped };
}

export async function renderResumePdf(profile: ProfileData, template: string): Promise<Buffer> {
  return (await renderResumeDetailed(profile, template)).buffer;
}
