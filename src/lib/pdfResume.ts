// src/lib/pdfResume.ts
// Renders a profile into a one-page PDF with pdfkit (pure JS, so it also runs on serverless hosts like Vercel).
// The three layouts mirror the template previews in /public/templates:
//   modern   – big name, left "details / skills" column with bar underlines, thin vertical divider
//   classic  – centered serif header, grey section bands, diamond bullets with dotted leaders
//   creative – grey side panel, boxed name, ruled section titles
// Everything is drawn at a scale factor `k`; if the content does not fit on one page we retry
// with a smaller k until it does (down to MIN_SCALE, after which it flows onto a second page).
import { withSelfEmployed } from "@/lib/selfEmployed";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { groupSkills } from "@/lib/skillGroups";
import { accentHex, shade, tint } from "@/lib/accents";
import { BLOBS, DROPS, pastelPalette, smoothPath } from "@/lib/blobs";
import { experienceYears, keyFigures } from "@/lib/stats";
import { placeLine } from "@/lib/place";
import { orderedSections } from "@/lib/sectionOrder";
import { formatPeriod, type ResumeLang } from "@/lib/dateFormat";
import { formatContactPhone } from "@/lib/phone";
import { levelFraction } from "@/lib/languages";
import { skillLevel } from "@/lib/skillLevels";
import { displayUrl, labeledLink, shortContactLink } from "@/lib/links";
import { TEMPLATE_IDS, PHOTO_RADIUS, asTemplateId, photoShapeOf, supportsPhoto, type PhotoShape, type TemplateId } from "@/lib/templates";
import { SECTION_ICONS, type SectionIconKey } from "@/lib/sectionIcons";
import type { ProfileData, JobEntry, EducationEntry, ProjectEntry } from "@/context/profileContext";

type Doc = PDFKit.PDFDocument;

export type ResumeTemplate = TemplateId;
export const RESUME_TEMPLATES = TEMPLATE_IDS;
export const asTemplate = asTemplateId;

const W = 595.28;
const H = 841.89;
const BOTTOM = 30; // page break threshold (bottom margin)

const INK = "#1a1a1a";
const BODY = "#4a4a4a";
const MUTED = "#6b6b6b";
const HAIR = "#dcdcdc";
const PANEL = "#f1f1f1";

// fine steps so the page is filled as much as it can be without spilling onto a second one
const SCALES = Array.from({ length: 31 }, (_, i) => Math.round((1 - i * 0.02) * 100) / 100); // 1 down to 0.4

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

/**
 * The text is scaled together with everything else, as the live preview does: the whole page is drawn smaller until it fits on ONE page, so
 * the PDF looks like the preview. (A look could ask for a minimum text size through `floor`; none does.)
 */
const FONT_FLOOR = 0;
/** Everything always goes on ONE page: the scale goes down (see SCALES, to 40%) until the resume fits. */
const FLOORS = [FONT_FLOOR];

class Pen {
  /** Decoded profile photo, when the resume should show one. */
  photo?: Buffer;
  /** The shape the look gives the photo (a circle, a rounded square or a square). */
  shape: PhotoShape = "circle";
  /** The cards of a look that puts its sections on cards: the first pass writes them down, the second paints them first. */
  collect?: { y0: number; y1: number }[];
  cards?: { y0: number; y1: number }[];

  constructor(public doc: Doc, public k: number, public floor: number = FONT_FLOOR) {}

  /** The scale of the TEXT: the layout may shrink with `k`, the letters stop at the floor. */
  get fk(): number {
    return this.k < this.floor ? this.floor : this.k;
  }

  /** Draw the photo in the shape of the look (no border); returns false (and draws nothing) if there is no usable photo. */
  drawPhoto(cx: number, cy: number, r: number): boolean {
    if (!this.photo) return false;
    try {
      const side = 2 * r;
      this.doc.save();
      if (this.shape === "circle") this.doc.circle(cx, cy, r).clip();
      else this.doc.roundedRect(cx - r, cy - r, side, side, side * PHOTO_RADIUS[this.shape]).clip();
      this.doc.image(this.photo, cx - r, cy - r, { cover: [2 * r, 2 * r], align: "center", valign: "center" });
      this.doc.restore();
      return true;
    } catch {
      return false;
    }
  }

  /** The photo in a rectangle (cropped to fill it); false when there is none. */
  drawPhotoRect(x: number, y: number, w: number, h: number): boolean {
    if (!this.photo) return false;
    try {
      this.doc.save().rect(x, y, w, h).clip();
      this.doc.image(this.photo, x, y, { cover: [w, h], align: "center", valign: "center" });
      this.doc.restore();
      return true;
    } catch {
      return false;
    }
  }

  private apply(s: Style) {
    this.doc.font(s.font).fontSize(s.size * this.fk).fillColor(s.color ?? INK);
  }

  /** Height a piece of text would take at the given width. */
  measure(text: string, width: number, s: Style): number {
    this.apply(s);
    return this.doc.heightOfString(text, {
      width,
      lineGap: (s.gap ?? 1.5) * this.k,
      characterSpacing: (s.spacing ?? 0) * this.fk,
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
    return this.doc.widthOfString(text, { characterSpacing: (s.spacing ?? 0) * this.fk });
  }

  /** Draw wrapped text at (x, y) and return the y just below it. */
  text(text: string, x: number, y: number, width: number, s: Style): number {
    if (!text) return y;
    this.apply(s);
    this.doc.text(text, x, y, {
      width,
      align: s.align ?? "left",
      lineGap: (s.gap ?? 1.5) * this.k,
      characterSpacing: (s.spacing ?? 0) * this.fk,
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
      const dy = (ls.size - rs.size) * this.fk * 0.18;
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
// The language of the resume being drawn. Drawing is synchronous, so setting it at the start of render() is safe.
let LANG: ResumeLang = "en";
const ES_WORDS: Record<string, string> = {
  Profile: "Perfil", "Employment History": "Experiencia laboral", Education: "Educación", Skills: "Habilidades", Languages: "Idiomas",
  Projects: "Proyectos", Internships: "Prácticas", Certifications: "Certificaciones", Interests: "Intereses", Details: "Datos", "About Me": "Sobre mí", "Work experience": "Experiencia laboral",
  Native: "Nativo", Fluent: "Fluido", Advanced: "Avanzado", Intermediate: "Intermedio", Basic: "Básico",
  Summary: "Resumen", Overview: "Resumen", Experience: "Experiencia", Other: "Otros", Contact: "Contacto",
  "Professional Summary": "Resumen profesional", "Work Experience": "Experiencia laboral", "Career History": "Historial laboral", "Career summary": "Resumen de trayectoria",
  Name: "Nombre", Address: "Dirección", Phone: "Teléfono", Email: "Correo", Links: "Enlaces", Year: "Año", Month: "Mes", "Education and work history": "Formación y experiencia",
  "Work history": "Experiencia", Entered: "Ingreso", Graduated: "Egreso", Joined: "Ingreso", Left: "Salida", Current: "Actualidad", "End of list": "Fin",
  "Licenses and certifications": "Licencias y certificaciones", Position: "Puesto", Location: "Lugar", Duties: "Funciones", Period: "Periodo", Date: "Fecha", Resume: "Currículum", "Years of experience": "Años de experiencia",
};
const L = (word: string) => (LANG === "es" ? ES_WORDS[word] ?? word : word);

const jobDates = (j: JobEntry) => formatPeriod(j, " - ", LANG);
const eduDates = (e: EducationEntry) => formatPeriod(e, " - ", LANG);
/** "GPA: 3.8 | Dean's List" and "Coursework: ..." lines, only the ones that have content. */
const eduExtras = (e: EducationEntry) => ({
  honors: [clean(e.gpa) ? `${LANG === "es" ? "Promedio" : "GPA"}: ${clean(e.gpa)}` : "", clean(e.honors)].filter(Boolean).join("  |  "),
  coursework: clean(e.coursework) ? `${LANG === "es" ? "Cursos" : "Coursework"}: ${clean(e.coursework)}` : "",
});
/** Skills with their optional 1-5 level (0 = none: then no bar, dots or label is drawn). */
const linksOf = (p: ProfileData) => (p.links || []).map((l) => ({ label: clean(l.label), url: clean(l.url) })).filter((l) => l.url);
const interestsOf = (p: ProfileData) => (p.interests || []).map((x) => clean(x)).filter(Boolean);
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
    ...linksOf(p).map((l) => ({ label: l.label || "Link", value: labeledLink(l.label, l.url) })),
  ].filter((d) => d.value);

/** "Taylor Cook" -> ["TAYLOR", "COOK"]; long names wrap on the last word. */
function nameLines(name: string): string[] {
  const parts = clean(name).toUpperCase().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return [parts[0] || "YOUR NAME"];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
}

/**
 * The skills as short paragraphs, one per group (the name of the group, and under it "React, Next.js, ..."), instead of one row each: a long
 * list in one row per skill took a whole column and made the rest of the page shrink. Used where no skill has a level to draw.
 */
function skillParagraphs(pen: Pen, p: ProfileData, x: number, y: number, w: number, label: Style, text: Style, after: number): number {
  const groups = groupSkills(p.skills ?? [], p.skillGroups)
    .map((g) => ({ label: clean(g.label), skills: g.skills.map((x) => clean(x)).filter(Boolean) }))
    .filter((g) => g.skills.length);
  const grouped = groups.some((g) => g.label);
  const k = pen.k;
  for (const g of groups) {
    const name = g.label || (grouped ? L("Other") : "");
    if (name) y = pen.text(name, x, y, w, label) + 1.5 * k;
    y = pen.text(g.skills.join(", "), x, y, w, text) + after * k;
  }
  return y;
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

    t = L(t);
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
    if (skills.every((x) => !x.level)) {
      // no levels to draw: the skills go in short paragraphs by group, not one row each (that column set the size of the whole page)
      sy = skillParagraphs(pen, p, ML, sy, sideW, { font: "Helvetica-Bold", size: 8.8, color: INK, gap: 1 }, { font: "Helvetica", size: 8.6, color: INK, gap: 1.8 }, 7);
    } else {
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
  }
  const langs = languagesOf(p);
  if (langs.length) {
    sy += 10 * k;
    sy = title("Languages", ML, sy, sideW);
    for (const l of langs) {
      sy = pen.leftRight(l.name, L(l.level), ML, sy, sideW, { font: "Helvetica", size: 8.8, color: INK }, { font: "Helvetica", size: 7, color: MUTED }) + 3 * k;
      pen.rect(ML, sy, sideW, 2.6 * k, "#d6d6d6");
      pen.rect(ML, sy, sideW * levelFraction(l.level), 2.6 * k, INK);
      sy += 2.6 * k + 8 * k;
    }
  }

  // Right column
  let my = bodyTop;
  const section = (t: string) => {
    t = L(t);
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
    const ints = interestsOf(p);
    if (ints.length) {
      section("Interests");
      my = pen.text(ints.join("  ·  "), mainX, my, mainW, { font: "Helvetica", size: 8.8, color: BODY, gap: 1.8 }) + 6 * k;
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
  const ML = 38;
  const MR = 38;
  const cw = W - ML - MR;
  const c = p.contactInfo;

  // Header: with a photo it sits on the left and the centered text keeps the page centered
  const pr = pen.photo ? 28 * k : 0;
  const hx = pen.photo ? ML + 2 * pr + 14 : ML;
  const hw = pen.photo ? cw - 2 * (2 * pr + 14) : cw;
  let y = 40;
  const classicName = clean(p.name).toUpperCase() || "YOUR NAME";
  y = pen.text(classicName, hx, y, hw, pen.fit(classicName, { font: "Times-Bold", size: 19, spacing: 2, align: "center" }, hw, 11));
  if (clean(p.jobTitle)) {
    y = pen.text(clean(p.jobTitle), hx, y + 3 * k, hw, { font: "Times-Roman", size: 10, align: "center" });
  }
  if (clean(placeLine(c))) {
    y = pen.text(clean(placeLine(c)), hx, y + 4 * k, hw, { font: "Times-Roman", size: 8.6, color: BODY, align: "center" });
  }
  const linkLine = linksOf(p).map((l) => displayUrl(l.url)).join("  ·  ");
  if (linkLine) y = pen.text(linkLine, hx, y + 3 * k, hw, { font: "Times-Roman", size: 8.2, color: BODY, align: "center" });
  if (pen.photo && pen.drawPhoto(ML + pr, 40 + pr, pr)) y = Math.max(y, 40 + 2 * pr);
  y += 7 * k;
  if (clean(c?.phone) || clean(c?.email)) {
    const ls: Style = { font: "Times-Roman", size: 10 }; // same size as the job title above
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

    t = L(t);
    y += 4 * k;
    const bh = 16 * k;
    pen.rect(ML, y, cw, bh, PANEL);
    const tw = pen.widthOf(t.toUpperCase(), { font: "Times-Bold", size: 10, spacing: 1.4 });
    pen.text(t.toUpperCase(), ML, y + 4.6 * k, cw, { font: "Times-Bold", size: 10, spacing: 1.4, align: "center" });
    const ux = ML + (cw - tw) / 2;
    pen.rule(ux, y + bh - 3.5 * k, ux + tw, INK, 0.8);
    y += bh + 6 * k;
  };

  const entryRow = (heading: string, dates: string) => {
    const top = y;
    diamond(pen, ML + 2 * k, top + 3 * k);
    const hx = ML + 16 * k;
    const hs: Style = { font: "Times-Bold", size: 9.4 };
    const ds: Style = { font: "Times-Roman", size: 7.7, color: BODY };
    const dw = dates ? pen.widthOf(dates, ds) : 0;
    const hw = pen.widthOf(heading, hs);
    const bottom = pen.leftRight(heading, dates, hx, top, W - MR - hx, hs, ds);
    if (dates && hw < W - MR - hx - dw - 30) leader(pen, hx + hw + 6, W - MR - dw - 6, top + 8.6 * k);
    y = bottom;
  };

  const bulletStyle: Style = { font: "Times-Roman", size: 8.5, color: INK, gap: 1.2 };


  // `tight` is for projects: the context goes right under the title
  const jobs = (list: JobEntry[], tight = false) => {
    for (const j of list) {
      entryRow(jobHeading(j), jobDates(j));
      y += (tight ? 0.5 : 3) * k;
      // like the template: the place sits small and right-aligned beside the first line of text.
      // It takes no space, so the text below is laid out exactly as if there were no location.
      const locStyle: Style = { font: "Times-Roman", size: 7.4, color: MUTED, align: "right" };
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
      y += 4 * k;
    }
  };

  // Each section is drawn by its own function, so the order can follow the person's choice
  const secs: Record<string, () => void> = {
    about: () => {
    if (clean(p.careerObjective)) {
      band("Profile");
      y = pen.text(clean(p.careerObjective), ML + 10 * k, y, cw - 20 * k, { font: "Times-Roman", size: 8.5, color: INK, gap: 1.4, align: "center" }) + 5 * k;
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
        const eLocStyle: Style = { font: "Times-Roman", size: 7.4, color: MUTED, align: "right" };
        const eLoc = clean(e.location);
        if (eLoc) pen.text(eLoc, ML, y + 1 * k, cw, eLocStyle);
        const eReserve = eLoc ? pen.widthOf(eLoc, eLocStyle) + 8 * k : 0;
        const sub = clean(e.school) ? clean(e.degree) : "";
        if (sub) y = pen.text(sub, ML + 16 * k, y + 1 * k, cw - 16 * k - eReserve, { font: "Times-Italic", size: 8.2, color: BODY });
        const extra = eduExtras(e);
        if (extra.honors) y = pen.text(extra.honors, ML + 16 * k, y + 1 * k, cw - 16 * k, { font: "Times-Roman", size: 8.2, color: BODY });
        if (extra.coursework) y = pen.text(extra.coursework, ML + 16 * k, y + 1 * k, cw - 16 * k, { font: "Times-Roman", size: 7.7, color: BODY, gap: 1 });
        y += 4 * k;
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
          const ls: Style = { font: "Times-Roman", size: 8.5 };
          if (s.level) {
            // five stars on the right, filled up to the level, with the dotted line running up to them
            const sr = 3.1 * k;
            const sGap = 1.4 * k;
            const starsW = 5 * 2 * sr + 4 * sGap;
            leader(pen, x + pen.widthOf(s.name, ls) + 6, x + colW - starsW - 6, cy + 8.2 * k);
            for (let i = 0; i < 5; i++) star(pen, x + colW - starsW + sr + i * (2 * sr + sGap), cy + 4.7 * k, sr, i < s.level);
            cy = pen.text(s.name, x, cy, colW, ls) + 2 * k;
          } else {
            cy = pen.text(s.name, x, cy, colW, ls) + 2 * k;
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
      const rs: Style = { font: "Times-BoldItalic", size: 8.2, color: INK };
      for (let col = 0; col < 2; col++) {
        let cy = startY;
        const x = ML + 4 * k + col * (colW + 20 * k);
        for (const l of langs.slice(col * perCol, (col + 1) * perCol)) {
          const ls: Style = { font: "Times-Roman", size: 8.5 };
          const lw = pen.widthOf(l.name, ls);
          const rw = pen.widthOf(L(l.level), rs);
          leader(pen, x + lw + 6, x + colW - rw - 6, cy + 8.2 * k);
          cy = pen.leftRight(l.name, L(l.level), x, cy, colW, ls, rs) + 2 * k;
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
        if (c.issuer) y = pen.text(c.issuer, ML + 16 * k, y + 1 * k, cw - 16 * k, { font: "Times-Italic", size: 8.2, color: BODY });
        y += 3 * k;
      }
    }
    const ints = interestsOf(p);
    if (ints.length) {
      band("Interests");
      y = pen.text(ints.join("  ·  "), ML + 16 * k, y, cw - 16 * k, { font: "Times-Roman", size: 8.4, color: BODY, gap: 1.2 }) + 4 * k;
    }

    },
  };
  for (const id of orderedSections(p.sectionOrder, ["about", "job", "education", "skills", "extras"])) secs[id]?.();
}

/* ===================================================================
   ESSENTIAL: the plain ATS standard, drawn like a classic Word resume (Calibri look):
   centered name, a contact line with small icons, a light rule under the header, bold capital titles with a dark rule,
   and a light rule closing every section. Text is one slate color; skills can go in groups, one line each.
   =================================================================== */
const ESS_INK = "#2e3d50";
const ESS_DARK = "#333f4f";
const ESS_LIGHT = "#dae3f3";
let ESS_FONT = { reg: "Helvetica", bold: "Helvetica-Bold" };

/** Carlito (metric-compatible with Calibri) is embedded for this look; if the files are missing, Helvetica is used. */
function registerEssentialFonts(doc: Doc) {
  ESS_FONT = { reg: "Helvetica", bold: "Helvetica-Bold" };
  try {
    const dir = path.join(process.cwd(), "public", "fonts");
    const reg = path.join(dir, "Carlito-Regular.ttf");
    const bold = path.join(dir, "Carlito-Bold.ttf");
    if (fs.existsSync(reg) && fs.existsSync(bold)) {
      doc.registerFont("Carlito", reg);
      doc.registerFont("Carlito-Bold", bold);
      ESS_FONT = { reg: "Carlito", bold: "Carlito-Bold" };
    }
  } catch {
    /* no fonts: Helvetica */
  }
}

type IconKind = "pin" | "mail" | "phone" | "home" | "globe" | "linkedin" | "github" | "link";
/** Small line icons (24x24 grid, the same shapes the on-screen preview uses). */
/** A section icon (the same shapes the live preview shows), drawn with a round stroke inside a square of `size` points. */
function drawSectionIcon(doc: Doc, key: SectionIconKey, x: number, y: number, size: number, color: string) {
  const g = size / 24;
  doc.save();
  doc.translate(x, y).scale(g).lineWidth(2).lineCap("round").lineJoin("round");
  for (const [tag, a] of SECTION_ICONS[key]) {
    if (tag === "path") doc.path(a.d);
    else if (tag === "circle") doc.circle(Number(a.cx), Number(a.cy), Number(a.r));
    else doc.roundedRect(Number(a.x), Number(a.y), Number(a.width), Number(a.height), Number(a.rx ?? 0));
    doc.stroke(color);
  }
  doc.restore();
}
function drawIcon(doc: Doc, kind: IconKind, x: number, y: number, size: number, color: string) {
  doc.save();
  doc.translate(x, y).scale(size / 24);
  doc.lineWidth(2.2).lineCap("round").lineJoin("round").strokeColor(color);
  switch (kind) {
    case "pin":
      doc.path("M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0").stroke();
      doc.circle(12, 10, 3).stroke();
      break;
    case "mail":
      doc.roundedRect(2, 4, 20, 16, 2).stroke();
      doc.path("m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7").stroke();
      break;
    case "phone":
      doc.roundedRect(5, 2, 14, 20, 2).stroke();
      doc.path("M12 18h.01").stroke();
      break;
    case "home":
      doc.path("M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8").stroke();
      doc.path("M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z").stroke();
      break;
    case "globe":
      doc.circle(12, 12, 10).stroke();
      doc.path("M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20").stroke();
      doc.path("M2 12h20").stroke();
      break;
    case "linkedin":
      doc.path("M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z").stroke();
      doc.rect(2, 9, 4, 12).stroke();
      doc.circle(4, 4, 2).stroke();
      break;
    case "github":
      doc.path("M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4").stroke();
      doc.path("M9 18c-4.51 2-5-2-7-2").stroke();
      break;
    default:
      doc.path("M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71").stroke();
      doc.path("M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71").stroke();
  }
  doc.restore();
}

/** Which icon a link gets, from its address or its name. */
export function linkIconKind(url: string, label = ""): "linkedin" | "github" | "globe" {
  const t = `${url} ${label}`.toLowerCase();
  return t.includes("linkedin") ? "linkedin" : t.includes("github") ? "github" : "globe";
}

/**
 * The contact details with their icons: an envelope for the email, a phone for the phone, a house for the address, "in" for
 * LinkedIn and a planet for any other web address. Next to its own icon a LinkedIn address is written short ("in/name").
 */
const contactList = (p: ProfileData): { icon: IconKind; text: string }[] => {
  const c = p.contactInfo;
  return [
    { icon: "mail" as IconKind, text: clean(c?.email) },
    { icon: "phone" as IconKind, text: formatContactPhone(clean(c?.phone), c?.countryCode) },
    { icon: "home" as IconKind, text: clean(placeLine(c)) },
    ...linksOf(p).map((l) => ({ icon: linkIconKind(l.url, l.label) as IconKind, text: shortContactLink(l.url) })),
  ].filter((i) => i.text);
};

function drawEssential(pen: Pen, p: ProfileData) {
  const k = pen.k;
  const ML = 36;
  const RIGHT = W - 33.5;
  const cw = RIGHT - ML;
  const F = ESS_FONT;
  const c = p.contactInfo;
  const body: Style = { font: F.reg, size: 8, color: ESS_INK, gap: 0.35 };
  const boldSmall: Style = { font: F.bold, size: 8, color: ESS_INK };
  const entryTitle: Style = { font: F.bold, size: 9.5, color: ESS_INK, gap: 0.3 };
  const name = clean(p.name) || "Your name";
  let y = 36 * k;

  /* ---- header: name, contact line with icons, light rule ---- */
  const pr = pen.photo ? 24 * k : 0;
  const side = pen.photo ? 2 * pr + 14 : 0;
  const nx = ML + side;
  const nw = cw - 2 * side;
  if (pen.photo) pen.drawPhoto(ML + pr, y + pr + 2 * k, pr);
  let ny = pen.text(name, nx, y, nw, pen.fit(name, { font: F.bold, size: 16, color: ESS_INK, align: "center" }, nw, 11));
  const title = clean(p.jobTitle);
  if (title) ny = pen.text(title, nx, ny + 1 * k, nw, { font: F.reg, size: 9, color: ESS_INK, align: "center" });

  const items: { icon: IconKind; text: string }[] = [
    { icon: "home" as IconKind, text: clean(placeLine(c)) },
    { icon: "mail" as IconKind, text: clean(c?.email) },
    { icon: "phone" as IconKind, text: formatContactPhone(clean(c?.phone), c?.countryCode) },
    ...linksOf(p).map((l) => ({ icon: linkIconKind(l.url, l.label) as IconKind, text: shortContactLink(l.url) })),
  ].filter((i) => i.text);
  const cs: Style = { font: F.reg, size: 7, color: ESS_INK };
  const iconSize = 7.2 * k;
  const gapIcon = 3 * k;
  const gapItem = 13 * k;
  let cy = ny + 3 * k;
  const rows: (typeof items)[] = [];
  let row: typeof items = [];
  let rowW = 0;
  const itemW = (i: { text: string }) => iconSize + gapIcon + pen.widthOf(i.text, cs);
  for (const it of items) {
    const w = itemW(it);
    if (row.length && rowW + gapItem + w > nw) {
      rows.push(row);
      row = [];
      rowW = 0;
    }
    rowW += (row.length ? gapItem : 0) + w;
    row.push(it);
  }
  if (row.length) rows.push(row);
  const lineH = pen.measure("Ag", nw, cs);
  for (const r of rows) {
    const total = r.reduce((a, i, n) => a + itemW(i) + (n ? gapItem : 0), 0);
    let x = nx + (nw - total) / 2;
    for (const it of r) {
      drawIcon(pen.doc, it.icon, x, cy + (lineH - iconSize) / 2 - 1 * k, iconSize, ESS_INK);
      pen.text(it.text, x + iconSize + gapIcon, cy, pen.widthOf(it.text, cs) + 4, { ...cs, gap: 0 });
      x += itemW(it) + gapItem;
    }
    cy += lineH + 1.5 * k;
  }
  y = Math.max(cy, y + 2 * pr) + 3 * k;
  pen.rule(33.4, y, W - 33.5, ESS_LIGHT, 1);

  /* ---- pieces ---- */
  const section = (t: string) => {
    y += 8 * k;
    const bottom = pen.text(L(t).toUpperCase(), ML, y, cw, { font: F.bold, size: 12, color: ESS_INK });
    pen.rule(33.4, bottom + 0.3 * k, W - 33.5, ESS_DARK, 1);
    y = bottom + 3.8 * k;
  };
  const endSection = () => {
    y += 4.5 * k;
    pen.rule(33.4, y, W - 33.5, ESS_LIGHT, 1);
  };
  const bullets = (list: string[]) => {
    for (const raw of list) {
      if (!clean(raw)) continue;
      pen.text("•", ML, y, 12 * k, body);
      y = pen.text(clean(raw), ML + 18 * k, y, cw - 18 * k, body) + 0.5 * k;
    }
  };
  const SEP = "  •  ";
  /** A job, an internship or a project: bold title, bold line with the company and the dates on the right, then bullets. */
  const entry = (j: JobEntry, meta: string[], project = false) => {
    const t = clean(j.title);
    const comp = clean(j.company);
    if (project || !comp) {
      y = pen.leftRight(t, meta.filter(Boolean).join(SEP), ML, y, cw, entryTitle, boldSmall) + 0.8 * k;
    } else {
      y = pen.text(t, ML, y, cw, entryTitle) + 0.2 * k;
      y = pen.leftRight(comp, meta.filter(Boolean).join(SEP), ML, y, cw, boldSmall, boldSmall) + 1.4 * k;
    }
    if (clean(j.description)) y = pen.text(clean(j.description), ML, y, cw, body) + 1 * k;
    bullets(j.accomplishments || []);
    y += 5 * k;
  };

  const secs: Record<string, () => void> = {
    about: () => {
      if (!clean(p.careerObjective)) return;
      section("Summary");
      y = pen.text(clean(p.careerObjective), ML, y, cw, body) + 3 * k;
      endSection();
    },
    job: () => {
      if (!p.jobHistory?.length) return;
      section("Experience");
      for (const j of p.jobHistory) entry(j, [jobDates(j), clean(j.location)]);
      y -= 2 * k;
      endSection();
    },
    education: () => {
      if (!p.education?.length) return;
      section("Education");
      for (const e of p.education) {
        y = pen.text(clean(e.degree) || clean(e.school), ML, y, cw, entryTitle) + 0.2 * k;
        const line = [clean(e.degree) ? clean(e.school) : "", clean(e.location), eduDates(e)].filter(Boolean).join(SEP);
        if (line) y = pen.text(line, ML, y, cw, body) + 0.6 * k;
        const extra = eduExtras(e);
        if (extra.honors) y = pen.text(extra.honors, ML, y, cw, body) + 0.6 * k;
        if (extra.coursework) y = pen.text(extra.coursework, ML, y, cw, body) + 0.6 * k;
        y += 1.5 * k;
      }
      y += 1 * k;
      endSection();
    },
    skills: () => {
      const names = skillsOf(p).map((s) => s.name);
      const langs = languagesOf(p);
      if (!names.length && !langs.length) return;
      section(names.length ? "Skills" : "Languages");
      const groups = groupSkills(p.skills ?? [], p.skillGroups)
        .map((g) => ({ label: clean(g.label), skills: g.skills.map((s) => clean(s)).filter(Boolean) }))
        .filter((g) => g.skills.length);
      const grouped = groups.some((g) => g.label);
      for (const g of groups) {
        const label = g.label || (grouped ? L("Other") : "");
        y = pen.text(label ? `${label}: ${g.skills.join(", ")}` : g.skills.join(", "), ML, y, cw, body) + 1.5 * k;
      }
      if (langs.length) {
        const line = langs.map((l) => (l.level ? `${l.name} (${L(l.level)})` : l.name)).join(", ");
        y = pen.text(names.length ? `${L("Languages")}: ${line}` : line, ML, y, cw, body) + 1.5 * k;
      }
      y += 1 * k;
      endSection();
    },
    extras: () => {
      if (projectsOf(p).length) {
        section("Projects");
        for (const pr2 of p.projects || []) {
          if (!clean(pr2.name)) continue;
          const job = projectAsJob(pr2);
          entry(job, [displayUrl(clean(pr2.link)), jobDates(job)], true);
        }
        y -= 2 * k;
        endSection();
      }
      if (p.internships?.length) {
        section("Internships");
        for (const j of p.internships) entry(j, [jobDates(j), clean(j.location)]);
        y -= 2 * k;
        endSection();
      }
      const certs = certsOf(p);
      if (certs.length) {
        section("Certifications");
        for (const c2 of certs) {
          y = pen.leftRight(c2.name, c2.year, ML, y, cw, entryTitle, boldSmall) + 0.4 * k;
          if (c2.issuer) y = pen.text(c2.issuer, ML, y, cw, body) + 1.5 * k;
          y += 2 * k;
        }
        endSection();
      }
      const ints = interestsOf(p);
      if (ints.length) {
        section("Interests");
        y = pen.text(ints.join("  ·  "), ML, y, cw, body) + 2 * k;
        endSection();
      }
    },
  };
  for (const id of orderedSections(p.sectionOrder, ["about", "job", "education", "skills", "extras"])) secs[id]?.();
}

/* ===================================================================
   ESSENTIAL / EXECUTIVE / TECH: single column layouts that share one engine
   essential – the plain ATS standard: centered name and contact line, bold capital titles with a rule, tight spacing
   executive – navy header band, navy titles with a rule, skills in three columns
   tech      – mono accents, "// SECTION" titles, skills as chips, projects before experience
   =================================================================== */
type Single = "executive" | "tech" | "minimal" | "elegant" | "timeline" | "legal" | "press" | "health" | "corporate" | "warm" | "academic" | "halftone" | "banner";
const NAVY = "#1f3a5f";
const TEAL = "#0f766e";
const TEAL_SOFT = "#e3f4f1";
const BURGUNDY = "#7a2e3a";
const BURGUNDY_SOFT = "#dcc7ca";
const STEEL = "#2f5d9e";
const STEEL_SOFT = "#d9e3f3";
const QUIET = "#8a8f98";

function drawSingle(pen: Pen, p: ProfileData, v: Single) {
  const k = pen.k;
  // the look wears the color the person picked (its own when they picked none): these shadow the defaults above
  const base = accentHex(v, p.accentColor);
  const NAVY = base;
  const TEAL = base;
  const TEAL_SOFT = tint(base, 0.88);
  const BURGUNDY = base;
  const BURGUNDY_SOFT = tint(base, 0.8);
  const STEEL = base;
  const STEEL_SOFT = tint(base, 0.86);
  const ML = v === "banner" ? 30 : 46;
  const MR = ML;
  const cw = W - ML - MR;
  const CX = v === "corporate" ? ML + 104 * k : v === "banner" ? ML + 138 : ML; // where the text of a section starts
  const CW = W - MR - CX;
  const c = p.contactInfo;
  const accent = v === "executive" ? NAVY : v === "tech" ? TEAL : v === "elegant" ? BURGUNDY : v === "timeline" ? STEEL : v === "minimal" ? QUIET : base;
  const serif = v === "elegant" || v === "legal" || v === "press" || v === "academic";
  const sans = serif ? "Times-Roman" : "Helvetica";
  const bold = serif ? "Times-Bold" : "Helvetica-Bold";
  const ital = serif ? "Times-Italic" : "Helvetica-Oblique";
  const mono = "Courier";
  const monoBold = "Courier-Bold";

  const phone = formatContactPhone(clean(c?.phone), c?.countryCode);
  const contact = [clean(placeLine(c)), phone, clean(c?.email), ...linksOf(p).map((l) => displayUrl(l.url))].filter(Boolean);
  const name = clean(p.name) || "Your name";
  const title = clean(p.jobTitle);
  let y = 0;

  /* ---- header ---- */
  if (v === "executive") {
    const bandH = 92 * k;
    pen.rect(0, 0, W, bandH, NAVY);
    const pr = pen.photo ? 30 * k : 0;
    const nx = ML + (pen.photo ? 2 * pr + 14 : 0);
    const rw = Math.min(190, cw * 0.38);
    const nw = cw - (pen.photo ? 2 * pr + 14 : 0) - rw - 14;
    if (pen.photo) pen.drawPhoto(ML + pr, bandH / 2, pr);
    let ny = 22 * k;
    ny = pen.text(name, nx, ny, nw, pen.fit(name, { font: bold, size: 24, color: "#ffffff" }, nw, 14));
    if (title) pen.text(title, nx, ny + 3 * k, nw, { font: sans, size: 11, color: "#c9d6ea" });
    let cy = 24 * k;
    for (const line of contact) cy = pen.text(line, W - MR - rw, cy, rw, { font: sans, size: 8.6, color: "#e8eef8", align: "right" }) + 2.4 * k;
    y = bandH + 18 * k;
  } else if (v === "tech") {
    const pr = pen.photo ? 28 * k : 0;
    const nx = ML + (pen.photo ? 2 * pr + 14 : 0);
    const nw = cw - (pen.photo ? 2 * pr + 14 : 0);
    y = 40 * k;
    if (pen.photo) pen.drawPhoto(ML + pr, y + pr, pr);
    pen.rect(nx, y, 28 * k, 3 * k, TEAL);
    let ny = pen.text(name, nx, y + 9 * k, nw, pen.fit(name, { font: bold, size: 25, color: INK }, nw, 14));
    if (title) ny = pen.text(`> ${title}`, nx, ny + 3 * k, nw, { font: monoBold, size: 10.5, color: TEAL });
    if (contact.length) ny = pen.text(contact.join("   |   "), nx, ny + 6 * k, nw, { font: mono, size: 8, color: BODY, gap: 2 });
    y = Math.max(ny, y + 2 * pr) + 12 * k;
    pen.rule(ML, y, W - MR, HAIR, 0.8);
    y += 14 * k;
  } else if (v === "banner") {
    // a pale band with the contact, a band of the full color with the name, and a big round photo across both. The name and the
    // contact start where the text of the sections starts.
    // the bands, the photo and the column of the text keep their size and place whatever the text size is (only the text shrinks)
    const paleH = 88;
    const darkH = 44;
    pen.rect(0, 0, W, paleH, tint(base, 0.88));
    pen.rect(0, paleH, W, darkH, base);
    const pr = 40;
    if (pen.photo) pen.drawPhoto(ML - 2 + pr, paleH - pr / 2 + 8, pr); // a little more than half of it above the line of the dark band
    const nameX = CX;
    const textW = W - MR - nameX;
    let ty = title ? 13 : 28;
    // the text of the header keeps its size too (the sizes are divided by k, which the pen multiplies back in)
    if (title) ty = pen.text(title, nameX, ty, textW, { font: bold, size: 9.6 / k, color: shade(base, 0.2) }) + 6;
    // email and address on the left, phone and links on the right, each with its icon
    const items = contactList(p);
    const colA = items.filter((i) => i.icon === "mail" || i.icon === "home");
    const colB = items.filter((i) => i.icon !== "mail" && i.icon !== "home");
    const colW = textW * 0.56;
    const drawCol = (list: { icon: IconKind; text: string }[], x: number, w: number) => {
      let cy = ty;
      for (const it of list) {
        drawIcon(pen.doc, it.icon, x, cy + 0.6, 7.6, base);
        cy = pen.text(it.text, x + 12, cy, w - 13, { font: sans, size: 8.4 / k, color: INK, gap: 1.3 / k }) + 3.4;
      }
    };
    drawCol(colA, nameX, colW);
    drawCol(colB, nameX + colW + 8, textW - colW - 8);
    const upper = name.toUpperCase();
    const fitted = pen.fit(upper, { font: bold, size: 22 / k, color: "#ffffff", spacing: 0.8 / k }, textW, 12 / k);
    pen.text(upper, nameX, paleH + (darkH - (fitted.size ?? 22) * k * 1.15) / 2, textW, fitted);
    y = paleH + darkH + 24 * k;
  } else if (v === "legal" || v === "corporate") {
    // the name at the left, the contact stacked at the right, a strong rule under both
    const pr = pen.photo ? 26 * k : 0;
    const side = pen.photo ? 2 * pr + 14 : 0;
    const rw = Math.min(176, cw * 0.36);
    const nw = cw - side - rw - 14;
    y = 40 * k;
    if (pen.photo) pen.drawPhoto(ML + pr, y + pr, pr);
    const shown = v === "legal" ? name.toUpperCase() : name;
    let ny = pen.text(shown, ML + side, y, nw, pen.fit(shown, { font: bold, size: v === "legal" ? 22 : 25, color: INK, spacing: v === "legal" ? 1.4 : 0 }, nw, 13));
    if (title) ny = pen.text(title, ML + side, ny + 3 * k, nw, { font: v === "legal" ? ital : sans, size: 11, color: base });
    let cy = y;
    for (const line of contact) cy = pen.text(line, W - MR - rw, cy, rw, { font: sans, size: 8.8, color: BODY, align: "right" }) + 2 * k;
    y = Math.max(ny, cy, y + 2 * pr) + 9 * k;
    if (v === "legal") {
      pen.rule(ML, y, W - MR, base, 2);
      pen.rule(ML, y + 3.4 * k, W - MR, base, 0.5);
      y += 12 * k;
    } else {
      pen.rule(ML, y, W - MR, INK, 1.2);
      y += 6 * k;
    }
  } else if (v === "press") {
    // a masthead: a heavy rule, a big serif name, a thin rule, the role in spaced capitals
    const pr = pen.photo ? 28 * k : 0;
    const side = pen.photo ? 2 * pr + 14 : 0;
    const nx = ML + side;
    const nw = cw - 2 * side;
    y = 30 * k;
    pen.rule(ML, y, W - MR, INK, 3);
    y += 12 * k;
    if (pen.photo) pen.drawPhoto(ML + pr, y + pr + 4 * k, pr);
    let ny = pen.text(name, nx, y, nw, pen.fit(name, { font: bold, size: 34, color: INK, align: "center" }, nw, 18));
    pen.rule(ML, ny + 5 * k, W - MR, INK, 0.6);
    ny += 11 * k;
    if (title) ny = pen.text(title.toUpperCase(), nx, ny, nw, { font: "Helvetica-Bold", size: 8.6, color: base, align: "center", spacing: 2.4 }) + 4 * k;
    if (contact.length) ny = pen.text(contact.join("   |   "), nx, ny, nw, { font: "Helvetica", size: 8.4, color: BODY, align: "center", gap: 2 });
    y = Math.max(ny, y + 2 * pr) + 9 * k;
    pen.rule(ML, y, W - MR, INK, 0.6);
    pen.rule(ML, y + 2.6 * k, W - MR, INK, 0.3);
    y += 12 * k;
  } else if (v === "health") {
    // a soft band in the color, with a strip of the full color at its left
    const bandH = 96 * k;
    pen.rect(0, 0, W, bandH, tint(base, 0.9));
    pen.rect(0, 0, 6 * k, bandH, base);
    const pr = pen.photo ? 28 * k : 0;
    const side = pen.photo ? 2 * pr + 14 : 0;
    const nw = cw - side;
    if (pen.photo) pen.drawPhoto(ML + pr, bandH / 2, pr);
    let ny = 22 * k;
    ny = pen.text(name, ML + side, ny, nw, pen.fit(name, { font: bold, size: 24, color: shade(base, 0.35) }, nw, 14));
    if (title) ny = pen.text(title, ML + side, ny + 2 * k, nw, { font: sans, size: 11.5, color: base });
    if (contact.length) pen.text(contact.join("   \u2022   "), ML + side, ny + 6 * k, nw, { font: sans, size: 8.4, color: BODY, gap: 2 });
    y = bandH + 16 * k;
  } else if (v === "warm") {
    // a big round photo, the name and role beside it, a soft rule under
    const pr = pen.photo ? 36 * k : 0;
    const side = pen.photo ? 2 * pr + 18 : 0;
    const nw = cw - side;
    y = 38 * k;
    if (pen.photo) pen.drawPhoto(ML + pr, y + pr, pr);
    let ny = pen.text(name, ML + side, y + 2 * k, nw, pen.fit(name, { font: bold, size: 27, color: INK }, nw, 14));
    if (title) ny = pen.text(title, ML + side, ny + 3 * k, nw, { font: bold, size: 11.5, color: base });
    if (contact.length) ny = pen.text(contact.join("   \u00b7   "), ML + side, ny + 6 * k, nw, { font: sans, size: 8.6, color: BODY, gap: 2 });
    y = Math.max(ny, y + 2 * pr) + 10 * k;
    y += 4 * k;
  } else if (v === "academic") {
    // a centered name in spaced capitals, the role in italics, one thin rule; no photo
    y = 42 * k;
    const upper = name.toUpperCase();
    y = pen.text(upper, ML, y, cw, pen.fit(upper, { font: bold, size: 22, color: INK, spacing: 1.6, align: "center" }, cw, 13)) + 3 * k;
    if (title) y = pen.text(title, ML, y, cw, { font: ital, size: 11.5, color: base, align: "center" }) + 3 * k;
    if (contact.length) y = pen.text(contact.join("   |   "), ML, y, cw, { font: sans, size: 9, color: BODY, align: "center", gap: 2 }) + 8 * k;
    pen.rule(ML, y, W - MR, base, 1);
    y += 10 * k;
  } else if (v === "halftone") {
    // the name at the left; a field of dots grows towards the right edge (a halftone), in the color
    const bandH = 112 * k;
    const x0 = W * 0.42;
    const step = 7.2 * k;
    for (let cx = x0; cx < W + step; cx += step) {
      const t = (cx - x0) / (W - x0);
      for (let cy = step / 2; cy < bandH; cy += step) {
        const edge = 1 - Math.pow(Math.abs(cy - bandH / 2) / (bandH / 2), 2.2) * 0.55;
        const r = Math.max(0, 3.4 * k * Math.pow(t, 1.15) * edge);
        if (r > 0.35 * k) pen.doc.save().circle(cx, cy, r).fill(base).restore();
      }
    }
    const pr = pen.photo ? 30 * k : 0;
    const side = pen.photo ? 2 * pr + 14 : 0;
    const nw = x0 - ML - 8 - side + 90 * k;
    if (pen.photo) pen.drawPhoto(ML + pr, bandH / 2, pr);
    let ny = 30 * k;
    ny = pen.text(name, ML + side, ny, nw, pen.fit(name, { font: bold, size: 27, color: INK }, nw, 15));
    if (title) ny = pen.text(title, ML + side, ny + 3 * k, nw, { font: sans, size: 11, color: base });
    if (contact.length) pen.text(contact.join("   \u00b7   "), ML + side, ny + 6 * k, cw * 0.52, { font: sans, size: 8.2, color: BODY, gap: 2 });
    y = bandH + 14 * k;
  } else if (v === "minimal") {
    // airy: a big plain name at the left, the details in grey, a photo (if any) at the right, no rules at all
    const pr = pen.photo ? 28 * k : 0;
    const nw = cw - (pen.photo ? 2 * pr + 16 : 0);
    y = 46 * k;
    if (pen.photo) pen.drawPhoto(W - MR - pr, y + pr, pr);
    let ny = pen.text(name, ML, y, nw, pen.fit(name, { font: bold, size: 26, color: INK }, nw, 14));
    if (title) ny = pen.text(title, ML, ny + 3 * k, nw, { font: sans, size: 11, color: MUTED });
    if (contact.length) ny = pen.text(contact.join("   ·   "), ML, ny + 7 * k, nw, { font: sans, size: 8.4, color: MUTED, gap: 2 });
    y = Math.max(ny, y + 2 * pr) + 14 * k;
  } else if (v === "elegant") {
    // a serif name centered over a double rule (a photo, if any, sits at the left)
    const pr = pen.photo ? 26 * k : 0;
    const side = pen.photo ? 2 * pr + 14 : 0;
    const nx = ML + side;
    const nw = cw - 2 * side;
    y = 38 * k;
    if (pen.photo) pen.drawPhoto(ML + pr, y + pr + 4 * k, pr);
    let ny = pen.text(name, nx, y, nw, pen.fit(name, { font: bold, size: 27, color: INK, align: "center" }, nw, 15));
    if (title) ny = pen.text(title, nx, ny + 2 * k, nw, { font: ital, size: 11.5, color: BURGUNDY, align: "center" });
    if (contact.length) ny = pen.text(contact.join("   |   "), nx, ny + 5 * k, nw, { font: sans, size: 9, color: BODY, align: "center", gap: 2 });
    y = Math.max(ny, y + 2 * pr) + 9 * k;
    pen.rule(ML, y, W - MR, BURGUNDY, 1.6);
    pen.rule(ML, y + 3.2 * k, W - MR, BURGUNDY, 0.5);
    y += 10 * k;
  } else {
    // timeline: left name, the role in blue, a short blue bar; the photo (if any) at the right
    const pr = pen.photo ? 28 * k : 0;
    const nw = cw - (pen.photo ? 2 * pr + 16 : 0);
    y = 42 * k;
    if (pen.photo) pen.drawPhoto(W - MR - pr, y + pr, pr);
    let ny = pen.text(name, ML, y, nw, pen.fit(name, { font: bold, size: 27, color: INK }, nw, 14));
    if (title) ny = pen.text(title, ML, ny + 3 * k, nw, { font: bold, size: 11.5, color: STEEL });
    if (contact.length) ny = pen.text(contact.join("   •   "), ML, ny + 6 * k, nw, { font: sans, size: 8.5, color: BODY, gap: 2 });
    y = Math.max(ny, y + 2 * pr) + 8 * k;
    pen.rect(ML, y, 44 * k, 3 * k, STEEL);
    y += 14 * k;
  }

  /* ---- pieces ---- */
  let bannerFirst = true; // the banner look draws a rule between sections, none above the first
  const section = (t: string, stacked = false) => {
    t = L(t);
    y += 4 * k;
    if (v === "banner") {
      if (bannerFirst) bannerFirst = false;
      else {
        pen.rule(ML, y + 1 * k, W - MR, tint(base, 0.8), 3.2);
        y += 12 * k;
      }
      // the name of the section stays on one line (it shrinks a little if it is long); sections made of dated entries leave it alone
      // on its row, and the entries start below it with their dates in this same column
      const label = t.toUpperCase();
      const bottom = pen.text(label, ML, y, CX - ML - 8 * k, pen.fit(label, { font: bold, size: 8.4, color: base, spacing: 0.5, gap: 1.5 }, CX - ML - 12 * k, 6));
      if (stacked) y = bottom + 5 * k;
    } else if (v === "executive") {
      const st: Style = { font: bold, size: 10.2, color: NAVY, spacing: 1.2 };
      const bottom = pen.text(t.toUpperCase(), ML, y, cw, st);
      pen.rule(ML, bottom + 3 * k, W - MR, NAVY, 1);
      y = bottom + 3 * k + 9 * k;
    } else if (v === "legal") {
      const bottom = pen.text(t.toUpperCase(), ML, y, cw, { font: bold, size: 10.6, color: base, spacing: 1.4 });
      pen.rule(ML, bottom + 2 * k, W - MR, base, 0.8);
      y = bottom + 2 * k + 7 * k;
    } else if (v === "press") {
      const bottom = pen.text(t.toUpperCase(), ML, y, cw, { font: "Helvetica-Bold", size: 8.8, color: base, spacing: 2 });
      pen.rule(ML, bottom + 2.4 * k, W - MR, INK, 0.5);
      y = bottom + 2.4 * k + 7 * k;
    } else if (v === "health") {
      pen.doc.save().circle(ML + 3 * k, y + 5.8 * k, 2.8 * k).fill(base).restore();
      const bottom = pen.text(t.toUpperCase(), ML + 11 * k, y, cw - 11 * k, { font: bold, size: 9.8, color: base, spacing: 1.2 });
      pen.rule(ML, bottom + 3 * k, W - MR, tint(base, 0.72), 1);
      y = bottom + 3 * k + 8 * k;
    } else if (v === "warm") {
      const st: Style = { font: bold, size: 8.8, color: shade(base, 0.2), spacing: 1.2 };
      const label = t.toUpperCase();
      const w = pen.widthOf(label, st) + 18 * k;
      pen.doc.save().roundedRect(ML, y, w, 15 * k, 7.5 * k).fill(tint(base, 0.86)).restore();
      pen.text(label, ML + 9 * k, y + 3.6 * k, w, { ...st, gap: 0 });
      y += 15 * k + 8 * k;
    } else if (v === "corporate") {
      // the name of the section sits in a column at the left; the text of the section starts level with it
      pen.rule(ML, y + 2 * k, W - MR, HAIR, 0.8);
      y += 9 * k;
      pen.text(t.toUpperCase(), ML, y, CX - ML - 10, { font: bold, size: 8.4, color: base, spacing: 1.1, gap: 1.5 });
    } else if (v === "academic") {
      y += 3 * k;
      const bottom = pen.text(t.toUpperCase(), ML, y, cw, { font: bold, size: 10.4, color: base, spacing: 1.5 });
      pen.rule(ML, bottom + 2 * k, W - MR, tint(base, 0.6), 0.7);
      y = bottom + 2 * k + 7 * k;
    } else if (v === "halftone") {
      y += 2 * k;
      const st: Style = { font: bold, size: 10, color: base, spacing: 1.6 };
      const label = t.toUpperCase();
      const bottom = pen.text(label, ML, y, cw, st);
      // a few dots that grow, like the header
      let dx = ML + pen.widthOf(label, st) + 10 * k;
      for (let i = 0; i < 9; i++) {
        pen.doc.save().circle(dx, y + 6 * k, (0.5 + i * 0.32) * k).fill(base).restore();
        dx += (3 + i * 0.9) * k;
      }
      pen.rule(ML, bottom + 3 * k, W - MR, tint(base, 0.78), 0.8);
      y = bottom + 3 * k + 8 * k;
    } else if (v === "minimal") {
      y += 6 * k;
      y = pen.text(t.toUpperCase(), ML, y, cw, { font: bold, size: 8.2, color: QUIET, spacing: 2.2 }) + 7 * k;
    } else if (v === "elegant") {
      const bottom = pen.text(t.toUpperCase(), ML, y, cw, { font: bold, size: 11, color: BURGUNDY, spacing: 1.6 });
      pen.rule(ML, bottom + 2 * k, W - MR, BURGUNDY_SOFT, 0.8);
      y = bottom + 2 * k + 7 * k;
    } else if (v === "timeline") {
      y += 2 * k;
      pen.rect(ML, y + 1.6 * k, 6.5 * k, 6.5 * k, STEEL);
      const bottom = pen.text(t.toUpperCase(), ML + 13 * k, y, cw - 13 * k, { font: bold, size: 9.8, color: STEEL, spacing: 1.4 });
      pen.rule(ML, bottom + 3 * k, W - MR, STEEL_SOFT, 1);
      y = bottom + 3 * k + 8 * k;
    } else {
      y = pen.text(`// ${t.toUpperCase()}`, ML, y, cw, { font: monoBold, size: 9.6, color: TEAL }) + 8 * k;
    }
  };
  // the timeline puts its entries to the right of a vertical line
  const EX = v === "timeline" ? ML + 15 * k : v === "academic" ? ML + 80 * k : CX;
  const EW = W - MR - EX;
  const size = serif ? 9.7 : 9;
  const headStyle: Style = { font: bold, size: v === "tech" ? 10 : serif ? 10.6 : 10.2, color: INK, gap: 1 };
  const dateStyle: Style =
    v === "tech" ? { font: mono, size: 8, color: MUTED } : { font: v === "executive" || serif ? ital : sans, size: serif ? 8.8 : 8.2, color: MUTED };
  const bodyStyle: Style = { font: sans, size, color: BODY, gap: 1.9 };
  const bullet = v === "tech" ? ">" : v === "minimal" ? "–" : "•";
  const bulletColor = v === "minimal" ? QUIET : v === "press" ? INK : base;

  /** On the timeline: the vertical line, with a dot at the top of every entry. */
  const mark = (top: number, bottom: number) => {
    if (v !== "timeline") return;
    const x = ML + 3.2 * k;
    const dotY = top + 5.2 * k;
    pen.doc.save().moveTo(x, dotY).lineTo(x, Math.max(dotY, bottom - 5 * k)).lineWidth(1.1 * k).stroke("#bccbe6").restore();
    pen.doc.save().circle(x, dotY, 3.1 * k).fill(STEEL).restore();
    pen.doc.save().circle(x, dotY, 1.2 * k).fill("#ffffff").restore();
  };

  /** Banner: the dates in the left column, the title in one line, and under it the organization with its place. */
  const bannerEntry = (title: string, org: string, place: string, dates: string) => {
    if (dates) pen.text(dates, ML, y + 0.8 * k, CX - ML - 8 * k, { font: sans, size: 8.2, color: INK, gap: 0 });
    y = pen.text(title, EX, y, EW, pen.fit(title, { font: bold, size: 10.2, color: INK, gap: 1 }, EW, 7.5));
    const orgStyle: Style = { font: bold, size: 9, color: INK, gap: 1 };
    const ly = y + 1.2 * k;
    let bottom = ly;
    if (org) bottom = pen.text(org, EX, ly, EW, orgStyle);
    if (place) {
      const ox = org ? EX + pen.widthOf(org, orgStyle) + 4 * k : EX;
      if (org && ox > W - MR - 40) bottom = pen.text(place, EX, bottom, EW, { font: sans, size: 8.6, color: MUTED });
      else bottom = Math.max(bottom, pen.text(org ? `- ${place}` : place, ox, ly, W - MR - ox, { font: sans, size: 8.6, color: MUTED }));
    }
    y = bottom + 2.5 * k;
  };
  const entry = (heading: string, dates: string, place = "") => {
    if (v === "academic") {
      // the years in a column at the left, the rest beside them
      pen.text(dates, ML, y + 1 * k, EX - ML - 10 * k, dateStyle);
      y = pen.text(heading, EX, y, EW, headStyle);
      if (place) y = pen.text(place, EX, y + 1.5 * k, EW, { font: ital, size: 8.8, color: MUTED });
      y += 2.5 * k;
      return;
    }
    y = pen.leftRight(heading, dates, EX, y, EW, headStyle, dateStyle);
    if (place) y = pen.text(place, EX, y + 1.5 * k, EW, { font: sans, size: 8.4, color: MUTED });
    y += 2.5 * k;
  };
  const jobs = (list: JobEntry[], tight = false) => {
    for (const j of list) {
      const top = y;
      if (v === "banner") bannerEntry(clean(j.title), clean(j.company), tight ? "" : clean(j.location), jobDates(j));
      else entry(jobHeading(j), jobDates(j), tight ? "" : clean(j.location));
      if (clean(j.description)) y = pen.text(clean(j.description), EX, y, EW, bodyStyle) + 3 * k;
      const bullets = (j.accomplishments || []).filter((b) => clean(b));
      for (const raw of bullets) {
        pen.text(bullet, EX + 2 * k, y, 10, { ...bodyStyle, color: bulletColor });
        y = pen.text(clean(raw), EX + 12 * k, y, EW - 12 * k, bodyStyle) + 2.4 * k;
      }
      mark(top, y);
      y += 6 * k;
    }
  };

  const chips = (items: string[]) => {
    const st: Style = { font: mono, size: 8.2, color: TEAL };
    let x = ML;
    const rowH = 12.5 * k;
    for (const it of items) {
      const w = pen.widthOf(it, st) + 12 * k;
      if (x + w > W - MR && x > ML) {
        x = ML;
        y += rowH + 4 * k;
      }
      pen.doc.save().roundedRect(x, y, w, rowH, 3 * k).fill(TEAL_SOFT).restore();
      pen.text(it, x + 6 * k, y + 2.6 * k, w, { ...st, gap: 0 });
      x += w + 4 * k;
    }
    y += rowH + 8 * k;
  };

  const secs: Record<string, () => void> = {
    about: () => {
      if (!clean(p.careerObjective)) return;
      section("Profile");
      y = pen.text(clean(p.careerObjective), CX, y, CW, { ...bodyStyle, size: size + 0.2, color: INK, gap: 2.1, align: v === "legal" ? "justify" : "left" }) + 7 * k;
    },
    job: () => {
      if (!p.jobHistory?.length) return;
      section("Employment History", true);
      jobs(p.jobHistory);
    },
    education: () => {
      if (!p.education?.length) return;
      section("Education", true);
      for (const e of p.education) {
        const top = y;
        if (v === "banner") bannerEntry(clean(e.degree), clean(e.school), clean(e.location), eduDates(e));
        else entry(eduHeading(e), eduDates(e), clean(e.location));
        const extra = eduExtras(e);
        if (extra.honors) y = pen.text(extra.honors, EX, y, EW, bodyStyle) + 1.5 * k;
        if (extra.coursework) y = pen.text(extra.coursework, EX, y, EW, { ...bodyStyle, size: size - 0.4 }) + 1.5 * k;
        mark(top, y);
        y += 6 * k;
      }
    },
    skills: () => {
      const skills = skillsOf(p);
      if (skills.length) {
        section("Skills");
        const groups = groupSkills(p.skills ?? [], p.skillGroups)
          .map((g) => ({ label: clean(g.label), skills: g.skills.map((s) => clean(s)).filter(Boolean) }))
          .filter((g) => g.skills.length);
        const grouped = groups.some((g) => g.label);
        if (v === "tech") chips(skills.map((s) => s.name));
        else if (v === "executive") {
          const cols = 3;
          const colW = cw / cols;
          const per = Math.ceil(skills.length / cols);
          const top = y;
          let maxY = y;
          for (let col = 0; col < cols; col++) {
            let cy = top;
            for (const s of skills.slice(col * per, (col + 1) * per)) {
              pen.rect(ML + col * colW, cy + 3.4 * k, 3 * k, 3 * k, NAVY);
              cy = pen.text(s.name, ML + col * colW + 9 * k, cy, colW - 14 * k, { font: sans, size: 9, color: INK }) + 2.4 * k;
            }
            maxY = Math.max(maxY, cy);
          }
          y = maxY + 6 * k;
        } else if (grouped) {
          for (const g of groups) {
            const label = g.label || L("Other");
            y = pen.text(`${label}: ${g.skills.join(", ")}`, CX, y, CW, { ...bodyStyle, color: INK, gap: 2 }) + 2.4 * k;
          }
          y += 3 * k;
        } else {
          y = pen.text(skills.map((s) => s.name).join(v === "minimal" ? "   ·   " : "  •  "), CX, y, CW, { ...bodyStyle, color: INK, gap: 2.4 }) + 7 * k;
        }
      }
      const langs = languagesOf(p);
      if (langs.length) {
        section("Languages");
        const line = langs.map((l) => (l.level ? `${l.name} (${L(l.level)})` : l.name)).join(v === "tech" ? "   |   " : "  ·  ");
        y = pen.text(line, CX, y, CW, { ...bodyStyle, color: INK, font: v === "tech" ? mono : sans, size: v === "tech" ? 8.6 : size }) + 7 * k;
      }
    },
    extras: () => {
      if (projectsOf(p).length) {
        section("Projects", true);
        jobs(projectsOf(p), true);
      }
      if (p.internships?.length) {
        section("Internships", true);
        jobs(p.internships);
      }
      const certs = certsOf(p);
      if (certs.length) {
        section("Certifications", true);
        for (const c2 of certs) {
          const top = y;
          if (v === "banner") bannerEntry(c2.name, c2.issuer, "", c2.year);
          else {
            entry(c2.name, c2.year);
            if (c2.issuer) y = pen.text(c2.issuer, EX, y - 1 * k, EW, { ...bodyStyle, size: size - 0.4 }) + 4 * k;
          }
          mark(top, y);
        }
      }
      const ints = interestsOf(p);
      if (ints.length) {
        section("Interests");
        y = pen.text(ints.join("  ·  "), EX, y, EW, bodyStyle) + 4 * k;
      }
    },
  };
  // technology puts skills and projects first; law and health put the studies before the jobs
  const order = v === "tech" ? ["about", "skills", "job", "extras", "education"] : v === "legal" || v === "health" ? ["about", "education", "job", "skills", "extras"] : ["about", "job", "education", "skills", "extras"];
  for (const id of orderedSections(p.sectionOrder, order)) secs[id]?.();
}

/* ===================================================================
   PURE ATS: nothing but text. One column, the standard section names, no colors, no rules, no icons, no photo.
   =================================================================== */
function drawAts(pen: Pen, p: ProfileData) {
  const k = pen.k;
  const ML = 38;
  const MR = 38;
  const cw = W - ML - MR;
  const sans = "Helvetica";
  const bold = "Helvetica-Bold";
  const BLACK = "#000000";
  const body: Style = { font: sans, size: 8.3, color: BLACK, gap: 1.1 };
  const c = p.contactInfo;
  const phone = formatContactPhone(clean(c?.phone), c?.countryCode);
  const contact = [clean(placeLine(c)), phone, clean(c?.email), ...linksOf(p).map((l) => displayUrl(l.url))].filter(Boolean);
  const name = clean(p.name) || "Your name";
  const title = clean(p.jobTitle);

  let y = 46 * k;
  y = pen.text(name, ML, y, cw, pen.fit(name, { font: bold, size: 17.5, color: BLACK }, cw, 11)) + 3 * k;
  if (title) y = pen.text(title, ML, y, cw, { font: sans, size: 9.6, color: BLACK }) + 2 * k;
  if (contact.length) y = pen.text(contact.join("  |  "), ML, y, cw, { ...body, size: 8.2 });
  y += 7 * k;

  const section = (t: string) => {
    y += 5 * k;
    y = pen.text(L(t).toUpperCase(), ML, y, cw, { font: bold, size: 9.4, color: BLACK }) + 3 * k;
  };
  const jobs = (list: JobEntry[], tight = false) => {
    for (const j of list) {
      y = pen.text(clean(j.title) || clean(j.company), ML, y, cw, { font: bold, size: 8.7, color: BLACK });
      const line2 = [clean(j.title) ? clean(j.company) : "", tight ? "" : clean(j.location), jobDates(j)].filter(Boolean).join(" | ");
      if (line2) y = pen.text(line2, ML, y, cw, body);
      y += 2 * k;
      if (clean(j.description)) y = pen.text(clean(j.description), ML, y, cw, body) + 2 * k;
      for (const raw of j.accomplishments || []) {
        if (!clean(raw)) continue;
        pen.text("-", ML + 2 * k, y, 10, body);
        y = pen.text(clean(raw), ML + 12 * k, y, cw - 12 * k, body) + 1 * k;
      }
      y += 4 * k;
    }
  };

  const secs: Record<string, () => void> = {
    about: () => {
      if (!clean(p.careerObjective)) return;
      section("Professional Summary");
      y = pen.text(clean(p.careerObjective), ML, y, cw, body) + 6 * k;
    },
    job: () => {
      if (!p.jobHistory?.length) return;
      section("Work Experience");
      jobs(p.jobHistory);
    },
    education: () => {
      if (!p.education?.length) return;
      section("Education");
      for (const e of p.education) {
        y = pen.text(clean(e.degree) || clean(e.school), ML, y, cw, { font: bold, size: 8.7, color: BLACK });
        const line2 = [clean(e.degree) ? clean(e.school) : "", clean(e.location), eduDates(e)].filter(Boolean).join(" | ");
        if (line2) y = pen.text(line2, ML, y, cw, body);
        const extra = eduExtras(e);
        if (extra.honors) y = pen.text(extra.honors, ML, y, cw, body);
        if (extra.coursework) y = pen.text(extra.coursework, ML, y, cw, body);
        y += 4 * k;
      }
    },
    skills: () => {
      const names = skillsOf(p).map((s2) => s2.name);
      const langs = languagesOf(p);
      if (names.length) {
        section("Skills");
        const groups = groupSkills(p.skills ?? [], p.skillGroups)
          .map((g) => ({ label: clean(g.label), skills: g.skills.map((s2) => clean(s2)).filter(Boolean) }))
          .filter((g) => g.skills.length);
        const grouped = groups.some((g) => g.label);
        for (const g of groups) {
          const label = g.label || (grouped ? L("Other") : "");
          y = pen.text(label ? `${label}: ${g.skills.join(", ")}` : g.skills.join(", "), ML, y, cw, body) + 1 * k;
        }
        y += 5 * k;
      }
      if (langs.length) {
        section("Languages");
        y = pen.text(langs.map((l) => (l.level ? `${l.name} (${L(l.level)})` : l.name)).join(", "), ML, y, cw, body) + 6 * k;
      }
    },
    extras: () => {
      if (projectsOf(p).length) {
        section("Projects");
        jobs(projectsOf(p), true);
      }
      if (p.internships?.length) {
        section("Internships");
        jobs(p.internships);
      }
      const certs = certsOf(p);
      if (certs.length) {
        section("Certifications");
        for (const c2 of certs) y = pen.text([c2.name, c2.issuer, c2.year].filter(Boolean).join(" - "), ML, y, cw, body) + 2 * k;
      }
      const ints = interestsOf(p);
      if (ints.length) {
        section("Interests");
        y = pen.text(ints.join(", "), ML, y, cw, body) + 2 * k;
      }
    },
  };
  for (const id of orderedSections(p.sectionOrder, ["about", "job", "education", "skills", "extras"])) secs[id]?.();
}

/* ===================================================================
   SHOKUMU (shokumukeirekisho): a Japanese career history. A title, your details and a career summary, then one ruled
   table per job with its position, place and duties. No photo.
   =================================================================== */
function drawShokumu(pen: Pen, p: ProfileData) {
  const k = pen.k;
  const ML = 44;
  const MR = 44;
  const cw = W - ML - MR;
  const base = accentHex("shokumu", p.accentColor);
  const LINE = "#8f98a3";
  const FILL = tint(base, 0.9);
  const HEAD = tint(base, 0.78);
  const LW = 88; // the width of the label column
  const sans = "Helvetica";
  const bold = "Helvetica-Bold";
  const body: Style = { font: sans, size: 8.8, color: INK, gap: 1.8 };
  const c = p.contactInfo;
  const phone = formatContactPhone(clean(c?.phone), c?.countryCode);
  const contact = [clean(placeLine(c)), phone, clean(c?.email), ...linksOf(p).map((l) => displayUrl(l.url))].filter(Boolean);
  const name = clean(p.name) || "Your name";
  let y = 40 * k;

  const box = (x: number, yy: number, w: number, h: number, fill?: string) => {
    if (fill) pen.doc.save().rect(x, yy, w, h).fill(fill).restore();
    pen.doc.save().rect(x, yy, w, h).lineWidth(0.8 * k).stroke(LINE).restore();
  };
  /** A row: a shaded label at the left and the content at the right (lines of text, or bullets). */
  const row = (label: string, lines: string[], bullet = false) => {
    const w = cw - LW * k - 14 * k;
    const bw = bullet ? 10 * k : 0;
    let h = 6 * k;
    const clean2 = lines.map((x) => clean(x)).filter(Boolean);
    for (const line of clean2) h += pen.measure(line, w - bw, body) + 2 * k;
    h = Math.max(h + 2 * k, 18 * k);
    box(ML, y, cw, h);
    pen.doc.save().rect(ML, y, LW * k, h).fill(FILL).restore();
    pen.doc.save().rect(ML, y, LW * k, h).lineWidth(0.8 * k).stroke(LINE).restore();
    pen.text(L(label), ML + 7 * k, y + 6 * k, LW * k - 12 * k, { font: bold, size: 8.2, color: INK, gap: 1 });
    let ty = y + 6 * k;
    for (const line of clean2) {
      if (bullet) pen.text("•", ML + LW * k + 7 * k, ty, 10, body);
      ty = pen.text(line, ML + LW * k + 7 * k + bw, ty, w - bw, body) + 2 * k;
    }
    y += h;
  };
  /** The title bar of a table: the name of the company or school at the left, the period at the right. */
  const head = (left: string, right = "") => {
    const h = 19 * k;
    box(ML, y, cw, h, HEAD);
    pen.leftRight(clean(left), clean(right), ML + 7 * k, y + 5 * k, cw - 14 * k, { font: bold, size: 9.4, color: INK }, { font: sans, size: 8.4, color: INK });
    y += h;
  };
  const title = (t: string) => {
    y += 8 * k;
    pen.rect(ML, y + 0.5 * k, 4 * k, 12 * k, base);
    y = pen.text(L(t), ML + 10 * k, y, cw - 10 * k, { font: bold, size: 11, color: INK }) + 5 * k;
  };

  /* ---- title, details ---- */
  y = pen.text(L("Career History"), ML, y, cw, { font: bold, size: 20, color: INK, align: "center" }) + 4 * k;
  y = pen.text(name, ML, y, cw, { font: sans, size: 9.6, color: INK, align: "right" }) + 4 * k;
  pen.rule(ML, y, W - MR, INK, 1.4);
  pen.rule(ML, y + 3 * k, W - MR, INK, 0.4);
  y += 14 * k;
  row("Name", [name + (clean(p.jobTitle) ? `  -  ${clean(p.jobTitle)}` : "")]);
  if (contact.length) row("Contact", [contact.join("   /   ")]);

  const secs: Record<string, () => void> = {
    about: () => {
      if (!clean(p.careerObjective)) return;
      title("Career summary");
      row("Overview", [clean(p.careerObjective)]);
      y += 4 * k;
    },
    job: () => {
      if (!p.jobHistory?.length) return;
      title("Work history");
      for (const j of p.jobHistory) {
        head(clean(j.company) || clean(j.title), jobDates(j));
        if (clean(j.company) && clean(j.title)) row("Position", [clean(j.title)]);
        if (clean(j.location)) row("Location", [clean(j.location)]);
        const bullets = (j.accomplishments || []).filter((b) => clean(b));
        const duties = bullets.length ? bullets : clean(j.description) ? [clean(j.description)] : [];
        if (duties.length) row("Duties", duties, bullets.length > 0);
        y += 8 * k;
      }
    },
    education: () => {
      if (!p.education?.length) return;
      title("Education");
      for (const e of p.education) {
        head(clean(e.school) || clean(e.degree), eduDates(e));
        if (clean(e.degree)) row("Position", [clean(e.degree)]);
        const extra = eduExtras(e);
        const notes = [extra.honors, extra.coursework, clean(e.location)].filter(Boolean);
        if (notes.length) row("Duties", notes);
        y += 8 * k;
      }
    },
    skills: () => {
      const skills = skillsOf(p);
      const langs = languagesOf(p);
      if (!skills.length && !langs.length) return;
      title("Skills");
      const groups = groupSkills(p.skills ?? [], p.skillGroups)
        .map((g) => ({ label: clean(g.label), skills: g.skills.map((s2) => clean(s2)).filter(Boolean) }))
        .filter((g) => g.skills.length);
      const grouped = groups.some((g) => g.label);
      for (const g of groups) row(g.label ? g.label : grouped ? L("Other") : "Skills", [g.skills.join(", ")]);
      if (langs.length) row("Languages", [langs.map((l) => (l.level ? `${l.name} (${L(l.level)})` : l.name)).join(", ")]);
      y += 6 * k;
    },
    extras: () => {
      if (projectsOf(p).length) {
        title("Projects");
        for (const j of projectsOf(p)) {
          head(clean(j.title), jobDates(j));
          const bullets = (j.accomplishments || []).filter((b) => clean(b));
          const duties = bullets.length ? bullets : clean(j.description) ? [clean(j.description)] : [];
          if (duties.length) row("Duties", duties, bullets.length > 0);
          y += 8 * k;
        }
      }
      if (p.internships?.length) {
        title("Internships");
        for (const j of p.internships) {
          head(clean(j.company) || clean(j.title), jobDates(j));
          if (clean(j.company) && clean(j.title)) row("Position", [clean(j.title)]);
          const bullets = (j.accomplishments || []).filter((b) => clean(b));
          if (bullets.length) row("Duties", bullets, true);
          y += 8 * k;
        }
      }
      const certs = certsOf(p);
      if (certs.length) {
        title("Certifications");
        for (const c2 of certs) row(c2.year || "Date", [[c2.name, c2.issuer].filter(Boolean).join(" - ")]);
      }
      const ints = interestsOf(p);
      if (ints.length) {
        title("Interests");
        row("", [ints.join(", ")]);
      }
    },
  };
  for (const id of orderedSections(p.sectionOrder, ["about", "job", "education", "skills", "extras"])) secs[id]?.();
}

/* ===================================================================
   RIREKISHO: the Japanese resume form. A ruled grid: a photo frame, your details in boxes, then a table of years and months with
   your studies and jobs from the oldest, and a table of licenses.
   =================================================================== */
function drawRirekisho(pen: Pen, p: ProfileData) {
  const k = pen.k;
  const ML = 40;
  const MR = 40;
  const cw = W - ML - MR;
  const LINE = "#222222";
  const FILL = "#eeeeee";
  const sans = "Helvetica";
  const bold = "Helvetica-Bold";
  const small: Style = { font: sans, size: 6.8, color: MUTED, gap: 1 };
  const body: Style = { font: sans, size: 9, color: INK, gap: 1.6 };
  const c = p.contactInfo;
  const phone = formatContactPhone(clean(c?.phone), c?.countryCode);
  const name = clean(p.name) || "Your name";
  let y = 34 * k;

  const frame = (x: number, yy: number, w: number, h: number, fill?: string) => {
    if (fill) pen.doc.save().rect(x, yy, w, h).fill(fill).restore();
    pen.doc.save().rect(x, yy, w, h).lineWidth(0.9 * k).stroke(LINE).restore();
  };
  const vline = (x: number, y1: number, y2: number) => pen.doc.save().moveTo(x, y1).lineTo(x, y2).lineWidth(0.7 * k).stroke(LINE).restore();
  /** The label of a box. */
  const formLab = (key: string, x: number, yy: number, w: number) => pen.text(L(key), x, yy, w, small);

  /* ---- top: the title, the photo frame, the details in boxes ---- */
  pen.text(L("Resume"), ML, y, 200, { font: bold, size: 21, color: INK });
  const phW = 78 * k;
  const phH = 104 * k;
  const phX = W - MR - phW;
  frame(phX, y, phW, phH);
  if (!pen.drawPhotoRect(phX, y, phW, phH)) pen.text("PHOTO", phX, y + phH / 2 - 8 * k, phW, { font: sans, size: 7, color: MUTED, align: "center" });
  const bx = ML;
  const bw = phX - 10 * k - bx;
  let by = y + 40 * k;
  // name
  frame(bx, by, bw, 46 * k);
  formLab("Name", bx + 5 * k, by + 4 * k, bw);
  pen.text(name, bx + 8 * k, by + 15 * k, bw - 14 * k, pen.fit(name, { font: bold, size: 20, color: INK }, bw - 14 * k, 12));
  by += 46 * k;
  // address
  const addr = clean(placeLine(c));
  frame(bx, by, bw, 30 * k);
  formLab("Address", bx + 5 * k, by + 4 * k, bw);
  pen.text(addr, bx + 8 * k, by + 14 * k, bw - 14 * k, body);
  by += 30 * k;
  // phone and email
  frame(bx, by, bw / 2, 30 * k);
  frame(bx + bw / 2, by, bw / 2, 30 * k);
  formLab("Phone", bx + 5 * k, by + 4 * k, bw / 2);
  pen.text(phone, bx + 8 * k, by + 14 * k, bw / 2 - 14 * k, body);
  pen.text(L("Email"), bx + bw / 2 + 5 * k, by + 4 * k, bw / 2, small);
  pen.text(clean(c?.email), bx + bw / 2 + 8 * k, by + 14 * k, bw / 2 - 14 * k, { ...body, size: 8.4 });
  by += 30 * k;
  y = Math.max(y + phH, by) + 12 * k;

  /* ---- the table of years and months ---- */
  const YW = 46 * k;
  const MW = 32 * k;
  const RH = 17 * k;
  const ym = (v?: string): [string, string] => {
    const m = /^(\d{4})-(\d{2})/.exec(v ?? "");
    return m ? [m[1], String(Number(m[2]))] : ["", ""];
  };
  type Line = { year?: string; month?: string; text?: string; section?: string; align?: "right"};
  const table = (heading: string, lines: Line[]) => {
    const hh = 16 * k;
    frame(ML, y, cw, hh, FILL);
    vline(ML + YW, y, y + hh);
    vline(ML + YW + MW, y, y + hh);
    pen.text(L("Year"), ML, y + 4.4 * k, YW, { font: bold, size: 8.4, color: INK, align: "center" });
    pen.text(L("Month"), ML + YW, y + 4.4 * k, MW, { font: bold, size: 8.4, color: INK, align: "center" });
    pen.text(L(heading), ML + YW + MW, y + 4.4 * k, cw - YW - MW, { font: bold, size: 8, color: INK, align: "center" });
    y += hh;
    for (const ln of lines) {
      frame(ML, y, cw, RH);
      if (ln.section) {
        pen.text(L(ln.section), ML, y + 4.6 * k, cw, { font: bold, size: 9, color: INK, align: "center" });
      } else {
        vline(ML + YW, y, y + RH);
        vline(ML + YW + MW, y, y + RH);
        if (ln.year) pen.text(ln.year, ML, y + 4.6 * k, YW, { font: sans, size: 9, color: INK, align: "center" });
        if (ln.month) pen.text(ln.month, ML + YW, y + 4.6 * k, MW, { font: sans, size: 9, color: INK, align: "center" });
        if (ln.text) {
          const st = { font: sans, size: 9, color: INK, align: ln.align ?? "left", lineBreak: false } as Style;
          pen.text(ln.text, ML + YW + MW + 7 * k, y + 4.6 * k, cw - YW - MW - 14 * k, st);
        }
      }
      y += RH;
    }
  };
  const sortKey = (v?: string) => v || "9999-99";
  const history: Line[] = [];
  const edus = [...(p.education ?? [])].sort((a, b) => sortKey(a.startDate || a.endDate).localeCompare(sortKey(b.startDate || b.endDate)));
  if (edus.length) {
    history.push({ section: "Education" });
    for (const e of edus) {
      const school = clean(e.school) || clean(e.degree);
      const [sy, sm] = ym(e.startDate);
      if (sy) history.push({ year: sy, month: sm, text: `${school}  -  ${L("Entered")}` });
      const [ey, em] = ym(e.endDate);
      if (e.current) history.push({ text: `${clean(e.degree) || school}  -  ${L("Current")}` });
      else if (ey) history.push({ year: ey, month: em, text: `${clean(e.degree) ? clean(e.degree) + ", " : ""}${school}  -  ${L("Graduated")}` });
      else if (!sy) history.push({ text: school });
    }
  }
  const jobsAsc = [...(p.jobHistory ?? [])].sort((a, b) => sortKey(a.startDate).localeCompare(sortKey(b.startDate)));
  if (jobsAsc.length) {
    history.push({ section: "Work history" });
    for (const j of jobsAsc) {
      const company = clean(j.company) || clean(j.title);
      const [sy, sm] = ym(j.startDate);
      history.push({ year: sy, month: sm, text: `${company}  -  ${L("Joined")}` });
      if (clean(j.title) && clean(j.company)) history.push({ text: `   ${clean(j.title)}` });
      const [ey, em] = ym(j.endDate);
      if (j.current || !ey) history.push({ text: `   ${L("Current")}` });
      else history.push({ year: ey, month: em, text: `${company}  -  ${L("Left")}` });
    }
  }
  // The form fills the page, like the paper one: the blank rows of the history grow until the rest (licenses, skills, summary) fits under it.
  const certs = certsOf(p);
  const skills = skillsOf(p).map((s2) => s2.name);
  const langs = languagesOf(p);
  const skillsText = skills.join(", ");
  const langsText = langs.map((l) => (l.level ? `${l.name} (${L(l.level)})` : l.name)).join(", ");
  const summaryText = clean(p.careerObjective);
  const boxH = (text: string, min: number) => Math.max(min, pen.measure(text, cw - 16 * k, body) + 22 * k) + 10 * k;
  const licRows = Math.max(certs.length, 2);
  const reserve = 16 * k + licRows * RH + 12 * k + (skillsText ? boxH(skillsText, 34 * k) : 0) + (langsText ? boxH(langsText, 34 * k) : 0) + boxH(summaryText, 58 * k);
  const room = H - BOTTOM - 10 * k - y - reserve - 16 * k - 12 * k;
  const wantRows = Math.floor(room / RH);
  const blanks = Math.max(0, wantRows - history.length - 1);
  for (let i = 0; i < blanks; i++) history.splice(history.length, 0, {});
  history.push({ text: L("End of list"), align: "right" });
  table("Education and work history", history);
  y += 12 * k;
  const licLines: Line[] = certs.map((c2) => ({ year: c2.year, text: [c2.name, c2.issuer].filter(Boolean).join(" - ") }));
  while (licLines.length < licRows) licLines.push({});
  table("Licenses and certifications", licLines);
  y += 12 * k;

  /* ---- skills and summary boxes ---- */
  const boxText = (label: string, text: string, min: number) => {
    const h = boxH(text, min) - 10 * k;
    frame(ML, y, cw, h);
    formLab(label, ML + 6 * k, y + 5 * k, cw);
    if (text) pen.text(text, ML + 8 * k, y + 16 * k, cw - 16 * k, body);
    y += h + 10 * k;
  };
  if (skillsText) boxText("Skills", skillsText, 34 * k);
  if (langsText) boxText("Languages", langsText, 34 * k);
  boxText("Summary", summaryText, 58 * k);
}

/* ===================================================================
   SIDEBAR: a dark column at the left (photo, contact, skills, languages) and the story at the right
   =================================================================== */
const SIDE_W = 190;
const SIDE_BG = "#1f2f46";
const SIDE_TEXT = "#eef3fa";
const SIDE_SOFT = "#9fb7d9";

function drawSidebarPanel(doc: Doc, color = SIDE_BG) {
  doc.save().rect(0, 0, SIDE_W, H).fill(color).restore();
}

function drawSidebar(pen: Pen, p: ProfileData) {
  const k = pen.k;
  const base = accentHex("sidebar", p.accentColor);
  const STEEL = base;
  const SIDE_SOFT = tint(base, 0.6);
  const SIDE_RULE = tint(shade(base, 0.5), 0.14);
  const c = p.contactInfo;
  const LX = 22;
  const LW = SIDE_W - LX - 18;
  const MX = SIDE_W + 26;
  const MW = W - 38 - MX;

  /* ---- left column ---- */
  let sy = 34 * k;
  if (pen.photo) {
    const r = 38 * k;
    pen.drawPhoto(SIDE_W / 2, sy + r, r);
    sy += 2 * r + 20 * k;
  } else {
    sy += 12 * k;
  }
  const head = (t: string) => {
    sy = pen.text(L(t).toUpperCase(), LX, sy, LW, { font: "Helvetica-Bold", size: 8.6, color: SIDE_SOFT, spacing: 1.6 });
    pen.rule(LX, sy + 2.5 * k, LX + LW, SIDE_RULE, 0.8);
    sy += 9 * k;
  };
  const phone = formatContactPhone(clean(c?.phone), c?.countryCode);
  const contactItems: { icon: IconKind; text: string }[] = [
    { icon: "home" as IconKind, text: clean(placeLine(c)) },
    { icon: "phone" as IconKind, text: phone },
    { icon: "mail" as IconKind, text: clean(c?.email) },
    ...linksOf(p).map((l) => ({ icon: linkIconKind(l.url, l.label) as IconKind, text: shortContactLink(l.url) })),
  ].filter((i) => i.text);
  if (contactItems.length) {
    head("Contact");
    const st: Style = { font: "Helvetica", size: 8.2, color: SIDE_TEXT, gap: 1.6 };
    for (const it of contactItems) {
      drawIcon(pen.doc, it.icon, LX, sy + 0.6 * k, 8 * k, SIDE_SOFT);
      sy = pen.text(it.text, LX + 14 * k, sy, LW - 14 * k, st) + 5.5 * k;
    }
    sy += 8 * k;
  }
  const skills = skillsOf(p);
  if (skills.length) {
    head("Skills");
    const groups = groupSkills(p.skills ?? [], p.skillGroups);
    const grouped = groups.some((g) => (g.label ?? "").trim());
    const levelOf = (n: string) => skills.find((s) => s.name === clean(n))?.level ?? 0;
    for (const g of groups) {
      if (grouped) sy = pen.text((g.label || L("Other")).toUpperCase(), LX, sy, LW, { font: "Helvetica-Bold", size: 6.8, color: SIDE_SOFT, spacing: 0.8 }) + 2.5 * k;
      for (const raw of g.skills) {
        const nm = clean(raw);
        if (!nm) continue;
        const level = levelOf(raw);
        const r = 1.6 * k;
        const dotsW = level ? 5 * 2 * r + 4 * 2.4 * k : 0;
        const st: Style = { font: "Helvetica", size: 8.4, color: SIDE_TEXT };
        const top = sy;
        sy = pen.text(nm, LX, sy, LW - (dotsW ? dotsW + 6 * k : 0), st);
        if (level) {
          const dotY = top + pen.measure("Ag", LW, st) / 2 - 1.2 * k;
          for (let i = 0; i < 5; i++) {
            const cx = LX + LW - dotsW + r + i * (2 * r + 2.4 * k);
            if (i < level) pen.doc.save().circle(cx, dotY, r).fill(SIDE_TEXT).restore();
            else pen.doc.save().circle(cx, dotY, r - 0.3 * k).lineWidth(0.6 * k).stroke(SIDE_SOFT).restore();
          }
        }
        sy += 3.6 * k;
      }
      if (grouped) sy += 4 * k;
    }
    sy += 8 * k;
  }
  const langs = languagesOf(p);
  if (langs.length) {
    head("Languages");
    for (const l of langs) {
      sy = pen.text(l.name, LX, sy, LW, { font: "Helvetica", size: 8.4, color: SIDE_TEXT });
      if (l.level) sy = pen.text(L(l.level), LX, sy + 0.5 * k, LW, { font: "Helvetica", size: 7.2, color: SIDE_SOFT });
      sy += 5 * k;
    }
  }

  /* ---- main column ---- */
  const name = clean(p.name) || "Your name";
  const role = clean(p.jobTitle);
  let my = 38 * k;
  my = pen.text(name, MX, my, MW, pen.fit(name, { font: "Helvetica-Bold", size: 26, color: INK }, MW, 14));
  if (role) my = pen.text(role, MX, my + 3 * k, MW, { font: "Helvetica", size: 12, color: STEEL });
  my += 16 * k;
  const section = (t: string) => {
    my += 2 * k;
    pen.rect(MX, my + 1 * k, 4 * k, 9 * k, STEEL);
    const bottom = pen.text(L(t).toUpperCase(), MX + 10 * k, my, MW - 10 * k, { font: "Helvetica-Bold", size: 10, color: INK, spacing: 1.2 });
    pen.rule(MX, bottom + 3 * k, MX + MW, "#dfe5ee", 1);
    my = bottom + 3 * k + 8 * k;
  };
  const bodyStyle: Style = { font: "Helvetica", size: 8.8, color: BODY, gap: 1.9 };
  const jobs = (list: JobEntry[], tight = false) => {
    for (const j of list) {
      my = pen.leftRight(jobHeading(j), tight ? jobDates(j) : clean(j.location), MX, my, MW, { font: "Helvetica-Bold", size: 9.8, gap: 1 }, { font: "Helvetica", size: 8, color: MUTED });
      const dates = tight ? "" : jobDates(j);
      if (dates) my = pen.text(dates, MX, my + 1.5 * k, MW, { font: "Helvetica-Oblique", size: 8, color: MUTED });
      my += (tight ? 1.5 : 3.5) * k;
      if (clean(j.description)) my = pen.text(clean(j.description), MX, my, MW, bodyStyle) + 3 * k;
      my = bulletList(pen, j.accomplishments || [], MX, my, MW, bodyStyle, 12, 2.4);
      my += 7 * k;
    }
  };
  const secs: Record<string, () => void> = {
    about: () => {
      if (!clean(p.careerObjective)) return;
      section("Profile");
      my = pen.text(clean(p.careerObjective), MX, my, MW, { ...bodyStyle, color: INK, gap: 2.2 }) + 9 * k;
    },
    job: () => {
      if (!p.jobHistory?.length) return;
      section("Employment History");
      jobs(p.jobHistory);
    },
    education: () => {
      if (!p.education?.length) return;
      section("Education");
      for (const e of p.education) {
        my = pen.leftRight(eduHeading(e), clean(e.location), MX, my, MW, { font: "Helvetica-Bold", size: 9.8, gap: 1 }, { font: "Helvetica", size: 8, color: MUTED });
        const dates = eduDates(e);
        if (dates) my = pen.text(dates, MX, my + 1.5 * k, MW, { font: "Helvetica-Oblique", size: 8, color: MUTED });
        const extra = eduExtras(e);
        if (extra.honors) my = pen.text(extra.honors, MX, my + 1.5 * k, MW, bodyStyle);
        if (extra.coursework) my = pen.text(extra.coursework, MX, my + 1.5 * k, MW, { ...bodyStyle, size: 8.2 });
        my += 8 * k;
      }
    },
    extras: () => {
      if (projectsOf(p).length) {
        section("Projects");
        jobs(projectsOf(p), true);
      }
      if (p.internships?.length) {
        section("Internships");
        jobs(p.internships);
      }
      const certs = certsOf(p);
      if (certs.length) {
        section("Certifications");
        for (const c2 of certs) {
          my = pen.leftRight(c2.name, c2.year, MX, my, MW, { font: "Helvetica-Bold", size: 9.4, gap: 1 }, { font: "Helvetica", size: 8, color: MUTED });
          if (c2.issuer) my = pen.text(c2.issuer, MX, my + 1 * k, MW, { font: "Helvetica", size: 8.2, color: BODY });
          my += 6 * k;
        }
      }
      const ints = interestsOf(p);
      if (ints.length) {
        section("Interests");
        my = pen.text(ints.join("  ·  "), MX, my, MW, { font: "Helvetica", size: 8.8, color: BODY, gap: 1.8 }) + 6 * k;
      }
    },
  };
  for (const id of orderedSections(p.sectionOrder, ["about", "job", "education", "extras"])) secs[id]?.();
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

    t = L(t);
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
    if (skills.every((x) => !x.level)) {
      sy = skillParagraphs(pen, p, leftX, sy, leftW, { font: "Helvetica-Bold", size: 8.4, gap: 1 }, { font: "Helvetica", size: 8.2, gap: 1.8 }, 6);
    } else {
      for (const s of skills) {
        // the dots go to the right of the skill, on its first line, so each skill takes one line instead of two
        const r = 1.7 * k;
        const dotsW = s.level ? 5 * 2 * r + 4 * 2.6 * k : 0;
        const style: Style = { font: "Helvetica", size: 8.4 };
        const top = sy;
        sy = pen.text(s.name, leftX, sy, leftW - (dotsW ? dotsW + 6 * k : 0), style);
        if (s.level) {
          const dotY = top + pen.measure("Ag", leftW, style) / 2 - 1.3 * k;
          for (let i = 0; i < 5; i++) {
            const cx = leftX + leftW - dotsW + r + i * (2 * r + 2.6 * k);
            if (i < s.level) pen.doc.save().circle(cx, dotY, r).fill(INK).restore();
            else pen.doc.save().circle(cx, dotY, r - 0.3 * k).lineWidth(0.6 * k).stroke(INK).restore();
          }
        }
        sy += 4.5 * k;
      }
    }
  }
  const langs = languagesOf(p);
  if (langs.length) {
    sy += 12 * k;
    sy = title("Languages", leftX, sy, leftW);
    for (const l of langs) {
      sy = pen.text(l.name, leftX, sy, leftW, { font: "Helvetica", size: 8.4 });
      if (l.level) sy = pen.text(L(l.level), leftX, sy + 1 * k, leftW, { font: "Helvetica", size: 7.2, color: MUTED });
      sy += 6 * k;
    }
  }

  // Right column
  let my = bodyTop;
  const section = (t: string) => {
    t = L(t);
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
    const ints = interestsOf(p);
    if (ints.length) {
      section("Interests");
      my = pen.text(ints.join("  ·  "), mainX, my, mainW, { font: "Helvetica", size: 8.6, color: BODY, gap: 1.8 }) + 6 * k;
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

/* ===================================================================
   FOUR MORE LOOKS that share this engine, each one a page background, a header and two columns:
   noir     – a dark band across the top with a round photo, a light column at the left, dots on the right
   blossom  – soft peach colors, an arch with the photo, rounded section tags and a vertical timeline
   pastel   – big bold name, soft colored shapes in the corners, a main column and a narrow one with segmented bars
   atelier  – a monogram and a spaced name, a thin header, two clean columns in slate colors
   =================================================================== */
type Gallery = "noir" | "blossom" | "pastel" | "atelier";
const GALLERY: readonly Gallery[] = ["noir", "blossom", "pastel", "atelier"];
const isGallery = (t: unknown): t is Gallery => (GALLERY as readonly unknown[]).includes(t);
const NOIR_PANEL = 232;

/** What is painted behind everything on every page: a column, a color, the shapes. */
function drawGalleryBack(doc: Doc, v: Gallery, base: string) {
  if (v === "noir") doc.save().rect(0, 0, NOIR_PANEL, H).fill(tint(base, 0.86)).restore();
  else if (v === "blossom") {
    doc.save().rect(0, 0, W, H).fill(tint(base, 0.95)).restore();
    doc.save().rect(0, H - 14, W, 14).fill(tint(base, 0.4)).restore();
  } else if (v === "pastel") {
    const P = pastelPalette(base);
    doc.save().rect(0, 0, W, H).fill(P.paper).restore();
    // soft shapes like cut paper (the paths are shared with the live preview)
    const shape = (key: keyof typeof BLOBS, color: string) => {
      doc.save().path(smoothPath(BLOBS[key].pts)).fill(color).restore();
      for (const [x, y, r] of DROPS[key] ?? []) doc.save().circle(x, y, r).fill(color).restore();
    };
    shape("mint", P.mint);
    shape("right", P.lavenderSoft);
    shape("left", P.lavender);
    shape("pinkSoft", P.lavenderSoft);
    shape("pink", P.pink);
    shape("center", P.ink);
    shape("ink", P.ink);
  }
}

function drawGallery(pen: Pen, p: ProfileData, v: Gallery) {
  const k = pen.k;
  const base = accentHex(v, p.accentColor);
  const sans = "Helvetica";
  const bold = "Helvetica-Bold";
  const c = p.contactInfo;
  const name = clean(p.name) || "Your name";
  const role = clean(p.jobTitle);
  const phone = formatContactPhone(clean(c?.phone), c?.countryCode);
  const email = clean(c?.email);
  const addr = clean(placeLine(c));
  const links = linksOf(p).map((l) => displayUrl(l.url));
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const summary = clean(p.careerObjective);
  const skills = skillsOf(p);
  const langs = languagesOf(p);
  const certs = certsOf(p);
  const ints = interestsOf(p);
  const jobs = p.jobHistory ?? [];
  const bulletsOf = (j: JobEntry) => (j.accomplishments || []).filter((b) => clean(b));
  const body: Style = { font: sans, size: 8.8, color: BODY, gap: 1.9 };
  const DARK = shade(base, 0.45);
  const orderOf = (ids: string[]) => orderedSections(p.sectionOrder, ids);

  /* ============================== NOIR ============================== */
  if (v === "noir") {
    // what encloses text (the band, the photo) follows the size of the TEXT; only the spaces between blocks shrink with k
    const kt = pen.fk;
    const bandY = 46 * k;
    const bandH = 150 * kt;
    // a soft shadow under the band, then the band
    const shadow = pen.doc.linearGradient(0, bandY + bandH, 0, bandY + bandH + 40 * k);
    shadow.stop(0, "#000000", 0.16).stop(1, "#000000", 0);
    pen.doc.save().rect(0, bandY + bandH, W, 40 * k).fill(shadow).restore();
    pen.rect(0, bandY, W, bandH, base);
    // the round photo is bigger than the band: it crosses it, with a white ring. Without a photo there is nothing of it.
    const hasPhoto = Boolean(pen.photo);
    if (hasPhoto) {
      const pr = 68 * kt;
      const pcx = NOIR_PANEL / 2;
      const pcy = bandY + bandH / 2;
      pen.doc.save().circle(pcx, pcy, pr + 2 * kt).fill("#ffffff").restore();
      pen.drawPhoto(pcx, pcy, pr);
    }
    // the name sits beside the photo; with no photo it starts at the left margin of the page
    const nx = hasPhoto ? NOIR_PANEL + 40 : 32;
    const nw = W - nx - 26;
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0] ?? name;
    const rest = parts.slice(1).join(" ");
    let ny = bandY + 26 * kt;
    ny = pen.text(first, nx, ny, nw, pen.fit(first, { font: bold, size: 38, color: "#ffffff", spacing: 6, gap: -2 }, nw, 16)) - 2 * kt;
    if (rest) ny = pen.text(rest, nx, ny, nw, pen.fit(rest, { font: sans, size: 38, color: "#ffffff", spacing: 6, gap: -2 }, nw, 16));
    if (role) pen.text(role, nx, ny + 8 * kt, nw, { font: sans, size: 15, color: "#e6e8ee" });

    const LX = 28;
    const LW = NOIR_PANEL - LX - 24;
    const RX = NOIR_PANEL + 30;
    const RW = W - 34 - RX;
    let ly = bandY + bandH + 40 * k;
    let ry = ly;
    // every section has a small icon of its own where the black square used to be
    const head = (title: string, icon: SectionIconKey, x: number, y: number, w: number) => {
      drawSectionIcon(pen.doc, icon, x, y + 0.6 * k, 13.5 * k, INK);
      return pen.text(L(title), x + 21 * k, y, w - 21 * k, { font: bold, size: 14.5, color: INK }) + 9 * k;
    };
    const leftBlocks: Record<string, () => void> = {
      about: () => {
        if (!summary) return;
        ly = head("About Me", "about", LX, ly, LW);
        ly = pen.text(summary, LX, ly, LW, { ...body, size: 9.4, color: INK, align: "justify", gap: 1.6 }) + 18 * k;
      },
      contact: () => {
        const items = contactList(p);
        if (!items.length) return;
        ly = head("Contact", "contact", LX, ly, LW);
        for (const it of items) {
          drawIcon(pen.doc, it.icon, LX, ly + 0.5 * k, 9.4 * k, INK);
          ly = pen.text(it.text, LX + 15 * k, ly, LW - 15 * k, { ...body, size: 9.7, color: INK }) + 6 * k;
        }
        ly += 14 * k;
      },
      skills: () => {
        if (skills.length) {
          ly = head("Skills", "skills", LX, ly, LW);
          ly = skillParagraphs(pen, p, LX, ly, LW, { ...body, font: bold, size: 9.7, color: INK, gap: 1 }, { ...body, size: 9.4, color: INK, gap: 1.8 }, 7) + 7 * k;
        }
        if (langs.length) {
          ly = head("Languages", "languages", LX, ly, LW);
          ly = bulletList(pen, langs.map((l) => (l.level ? `${l.name} (${L(l.level)})` : l.name)), LX + 4 * k, ly, LW - 4 * k, { ...body, size: 9.7, color: INK }, 12, 4.2) + 14 * k;
        }
        if (ints.length) {
          ly = head("Interests", "interests", LX, ly, LW);
          ly = bulletList(pen, ints, LX + 4 * k, ly, LW - 4 * k, { ...body, size: 9.7, color: INK }, 12, 4.2) + 14 * k;
        }
      },
    };
    const dot = (y: number) => pen.doc.save().circle(RX + 4 * k, y + 5 * k, 3.6 * k).fill(DARK).restore();
    const entry = (when: string, org: string, sub: string, bullets: string[], desc = "") => {
      dot(ry);
      if (when) ry = pen.text(when ? `(${when})` : "", RX + 16 * k, ry, RW - 16, { font: bold, size: 10.6, color: INK }) + 2.5 * k;
      if (org) ry = pen.text(org.toUpperCase(), RX + 16 * k, ry, RW - 16, { font: bold, size: 8.6, color: INK, gap: 1 }) + 1.5 * k;
      if (sub) ry = pen.text(sub, RX + 16 * k, ry, RW - 16, { font: sans, size: 9, color: BODY, gap: 1 }) + 2 * k;
      if (desc) ry = pen.text(desc, RX + 16 * k, ry, RW - 16, body) + 2 * k;
      ry = bulletList(pen, bullets, RX + 16 * k, ry, RW - 16, body, 11, 2.2);
      ry += 12 * k;
    };
    const rightBlocks: Record<string, () => void> = {
      education: () => {
        if (!p.education?.length) return;
        ry = head("Education", "education", RX, ry, RW);
        for (const e of p.education) {
          const x = eduExtras(e);
          entry(eduDates(e), clean(e.school) || clean(e.degree), clean(e.school) ? clean(e.degree) : "", [], [x.honors, x.coursework].filter(Boolean).join("\n"));
        }
      },
      job: () => {
        if (!jobs.length) return;
        ry = head("Employment History", "job", RX, ry, RW);
        for (const j of jobs) entry(jobDates(j), clean(j.title), [clean(j.company), clean(j.location)].filter(Boolean).join(", "), bulletsOf(j), clean(j.description));
      },
      extras: () => {
        if (projectsOf(p).length) {
          ry = head("Projects", "projects", RX, ry, RW);
          for (const j of projectsOf(p)) entry(jobDates(j), clean(j.title), "", bulletsOf(j), clean(j.description));
        }
        if (p.internships?.length) {
          ry = head("Internships", "internships", RX, ry, RW);
          for (const j of p.internships) entry(jobDates(j), clean(j.title), [clean(j.company), clean(j.location)].filter(Boolean).join(", "), bulletsOf(j), clean(j.description));
        }
        if (certs.length) {
          ry = head("Certifications", "certifications", RX, ry, RW);
          for (const c2 of certs) entry(c2.year, c2.name, c2.issuer, []);
        }
      },
    };
    for (const id of ["about", "contact", "skills"]) leftBlocks[id]?.();
    for (const id of orderOf(["education", "job", "extras"])) rightBlocks[id]?.();
    return;
  }

  /* ============================== BLOSSOM ============================== */
  if (v === "blossom") {
    const BROWN = shade(base, 0.2);
    const PEACH = tint(base, 0.86);
    const ROSE = tint(base, 0.4);
    const hasPhoto = Boolean(pen.photo);
    const ax = 368;
    const aw = 192;
    if (hasPhoto) {
      // the arch at the top right, with the photo in a circle
      const arch = tint(base, 0.45);
      pen.doc.save().rect(ax, 0, aw, 130 * k).fill(arch).restore();
      pen.doc.save().roundedRect(ax, 36 * k, aw, 186 * k, aw / 2).fill(arch).restore();
      pen.doc.save().roundedRect(ax + aw - 14, 0, 30, 190 * k, 15).fill(tint(base, 0.78)).restore();
      pen.drawPhoto(ax + aw / 2, 120 * k, 72 * k);
    }
    // the name, thin and big: one word per line (three lines at most), all of the same size, the one that makes the longest word fit
    const words = name.toUpperCase().split(/\s+/).filter(Boolean);
    const nameLines = words.length > 3 ? [words[0], words.slice(1, -1).join(" "), words[words.length - 1]] : words.length ? words : [name.toUpperCase()];
    const nx = 48;
    const nw = hasPhoto ? ax - nx - 8 : 300;
    let ny = 52 * k;
    const nameStyle = (t: string) => pen.fit(t, { font: sans, size: 57, color: BROWN, spacing: 2 }, nw - 6, 14);
    const nameSize = Math.min(57, ...nameLines.map((t) => nameStyle(t).size));
    nameLines.forEach((t, i) => {
      ny = pen.text(t, nx, ny - (i ? 2 * k : 0), nw, { ...nameStyle(t), size: nameSize, gap: -Math.round(nameSize * 0.14) });
    });
    let cy = Math.max(ny + 12 * k, hasPhoto ? 214 * k : 0);
    if (role) cy = pen.text(role, nx, cy, nw + 40, { font: bold, size: 19, color: BROWN }) + 14 * k;
    const drawContact = (x: number, y0: number, w: number) => {
      let yy = y0;
      for (const it of contactList(p)) {
        pen.doc.save().circle(x + 8 * k, yy + 6 * k, 8 * k).fill(BROWN).restore();
        drawIcon(pen.doc, it.icon, x + 3.4 * k, yy + 1.4 * k, 9.2 * k, "#ffffff");
        yy = pen.text(it.text, x + 25 * k, yy + 1.5 * k, w, { font: sans, size: 11.4, color: BROWN, gap: 1 }) + 10.5 * k;
      }
      return yy;
    };
    // with a photo the contact goes under the role; without one it takes the empty space at the right of the name
    if (hasPhoto) cy = drawContact(nx, cy, 250);
    else cy = Math.max(cy, drawContact(388, 70 * k, W - 36 - 388 - 24));
    // the vertical line sits further to the left than the middle, so the long text of the right column (jobs, projects) has more room
    const LX = 48;
    const LW = 184;
    const lineX = 256;
    const RX = 278;
    const RW = W - 36 - RX;
    let ly = cy + 30 * k;
    let ry = hasPhoto ? Math.max(244 * k, ly) : ly;
    const top = ry - 6 * k;
    const pill = (title: string, x: number, y: number) => {
      const t = L(title).toUpperCase();
      const st: Style = { font: bold, size: 14, color: BROWN, spacing: 0.4 };
      const w = pen.widthOf(t, st) + 32 * k;
      pen.doc.save().roundedRect(x, y, w, 29 * k, 14.5 * k).fill(PEACH).restore();
      pen.text(t, x + 16 * k, y + 7.6 * k, w, { ...st, gap: 0 });
      return y + 29 * k + 14 * k;
    };
    const lblock = (title: string, draw: () => void, has: boolean) => {
      if (!has) return;
      ly = pill(title, LX - 10 * k, ly);
      draw();
      ly += 16 * k;
    };
    const rdot = (y: number) => pen.doc.save().circle(lineX, y + 6 * k, 4.4 * k).fill(BROWN).restore();
    const rentry = (when: string, org: string, sub: string, bullets: string[], desc = "") => {
      rdot(ry);
      const rbody: Style = { ...body, size: 11, color: BROWN, gap: 2.4 };
      if (when) ry = pen.text(when, RX, ry, RW, { font: bold, size: 12.8, color: BROWN }) + 2.5 * k;
      if (org) ry = pen.text(org, RX, ry, RW, { font: bold, size: 12.6, color: BROWN, gap: 1 }) + 2.5 * k;
      if (sub) ry = pen.text(sub, RX, ry, RW, { font: sans, size: 11.2, color: BROWN, gap: 1 }) + 3 * k;
      if (desc) ry = pen.text(desc, RX, ry, RW, rbody) + 2 * k;
      ry = bulletList(pen, bullets, RX, ry, RW, rbody, 12, 2.6);
      ry += 12 * k;
    };
    const L1: Record<string, () => void> = {
      education: () =>
        lblock("Education", () => {
          for (const e of p.education ?? []) {
            const x = eduExtras(e);
            ly = pen.text(eduDates(e), LX, ly, LW, { font: bold, size: 13.6, color: BROWN }) + 3 * k;
            ly = pen.text(clean(e.school) || clean(e.degree), LX, ly, LW, { font: bold, size: 13.6, color: BROWN, gap: 1 }) + 3 * k;
            if (clean(e.school) && clean(e.degree)) ly = pen.text(clean(e.degree), LX, ly, LW, { ...body, size: 12.8, color: BROWN }) + 3 * k;
            for (const t of [x.honors, x.coursework]) if (t) ly = pen.text(t, LX, ly, LW, { ...body, size: 11.4, color: BROWN }) + 3 * k;
            ly += 16 * k;
          }
        }, Boolean(p.education?.length)),
      skills: () =>
        lblock("Skills", () => {
          // no levels to draw: the skills go in short paragraphs, one per group, instead of one row each (a long list took the whole page)
          if (skills.every((x) => !x.level)) {
            const groups = groupSkills(p.skills ?? [], p.skillGroups)
              .map((g) => ({ label: clean(g.label), skills: g.skills.map((x) => clean(x)).filter(Boolean) }))
              .filter((g) => g.skills.length);
            const grouped = groups.some((g) => g.label);
            for (const g of groups) {
              const label = g.label || (grouped ? L("Other") : "");
              if (label) ly = pen.text(label, LX, ly, LW, { font: bold, size: 11.4, color: BROWN, gap: 1 }) + 1.5 * k;
              ly = pen.text(g.skills.join(", "), LX, ly, LW, { font: sans, size: 11.2, color: BROWN, gap: 1.6 }) + 8 * k;
            }
            return;
          }
          for (const s of skills) {
            const w = pen.widthOf(s.name, { font: sans, size: 12.8, color: BROWN });
            const barX = LX + Math.min(Math.max(w + 12, 118), 134);
            const top2 = ly;
            ly = pen.text(s.name, LX, ly, barX - LX - 6, { font: sans, size: 12.8, color: BROWN, gap: 1 });
            if (s.level) {
              const bw = LX + LW - barX;
              pen.doc.save().roundedRect(barX, top2 + 4 * k, bw, 6 * k, 3 * k).fill(tint(base, 0.88)).restore();
              pen.doc.save().roundedRect(barX, top2 + 4 * k, (bw * s.level) / 5, 6 * k, 3 * k).fill(BROWN).restore();
            }
            ly += 10 * k;
          }
        }, skills.length > 0),
      languages: () =>
        lblock("Languages", () => {
          for (const l of langs) ly = pen.text(l.level ? `${l.name} (${L(l.level)})` : l.name, LX + 4 * k, ly, LW, { font: sans, size: 12.8, color: BROWN, gap: 1 }) + 9 * k;
        }, langs.length > 0),
      interests: () =>
        lblock("Interests", () => {
          for (const it of ints) ly = pen.text(it, LX + 4 * k, ly, LW, { font: sans, size: 12.8, color: BROWN, gap: 1 }) + 9 * k;
        }, ints.length > 0),
    };
    const R1: Record<string, () => void> = {
      about: () => {
        if (!summary) return;
        rdot(ry);
        ry = pen.text(summary, RX, ry, RW, { ...body, size: 11.4, color: BROWN, gap: 2.8 }) + 22 * k;
      },
      job: () => {
        if (!jobs.length) return;
        ry = pill("Work experience", RX - 8 * k, ry);
        for (const j of jobs) rentry(jobDates(j), clean(j.title), [clean(j.company), clean(j.location)].filter(Boolean).join(", "), bulletsOf(j), clean(j.description));
      },
      extras: () => {
        if (projectsOf(p).length) {
          ry = pill("Projects", RX - 8 * k, ry);
          for (const j of projectsOf(p)) rentry(jobDates(j), clean(j.title), "", bulletsOf(j), clean(j.description));
        }
        if (p.internships?.length) {
          ry = pill("Internships", RX - 8 * k, ry);
          for (const j of p.internships) rentry(jobDates(j), clean(j.title), [clean(j.company), clean(j.location)].filter(Boolean).join(", "), bulletsOf(j), clean(j.description));
        }
        if (certs.length) {
          ry = pill("Certifications", RX - 8 * k, ry);
          for (const c2 of certs) rentry(c2.year, c2.name, c2.issuer, []);
        }
      },
    };
    for (const id of ["education", "skills", "languages", "interests"]) L1[id]?.();
    for (const id of orderOf(["about", "job", "extras"])) R1[id]?.();
    // the vertical line of the timeline joins the dots
    pen.doc.save().moveTo(lineX, top).lineTo(lineX, Math.max(top + 40, ry - 14 * k)).lineWidth(1.6 * k).stroke(BROWN).restore();
    void ROSE;
    return;
  }

  /* ============================== PASTEL ============================== */
  if (v === "pastel") {
    const P = pastelPalette(base);
    const NAVY = P.ink;
    // the photo is cut to the outline of a soft shape, over the pale one (the shapes themselves are in the background)
    if (pen.photo) {
      try {
        pen.doc.save();
        pen.doc.path(smoothPath(BLOBS.photo.pts)).clip();
        pen.doc.image(pen.photo, 400, 0, { cover: [195, 190], align: "center", valign: "center" });
        pen.doc.restore();
      } catch {
        /* no usable photo */
      }
    }
    const mx = 41;
    const topW = 336;
    let y = 30 * k;
    y = pen.text(name, mx, y, topW, pen.fit(name, { font: bold, size: 42, color: NAVY, gap: -2 }, topW, 18));
    if (role) y = pen.text(role, mx, y + 3 * k, topW, pen.fit(role, { font: bold, size: 22, color: NAVY }, topW, 12));
    if (summary) y = pen.text(summary, mx, y + 12 * k, 336, { ...body, size: 10.2, color: INK, gap: 2.6 });
    // the two columns flow on their own: the main one starts right under the summary, the narrow one under the photo
    const MWID = 330;
    const RX = 414;
    const RW = W - 40 - RX;
    let ly = y + 22 * k;
    let ry = 282 * k;
    const head = (title: string, x: number, yy: number) => pen.text(L(title), x, yy, 300, { font: bold, size: 14.5, color: NAVY }) + 6 * k;
    const dateStyle: Style = { font: bold, size: 7, color: P.date, spacing: 0.4 };
    const entry = (title: string, when: string, bullets: string[], desc = "") => {
      ly = pen.text(title, mx, ly, MWID, { font: bold, size: 9.8, color: INK, gap: 1 }) + 1.5 * k;
      if (when) ly = pen.text(when.toUpperCase(), mx, ly, MWID, dateStyle) + 3 * k;
      if (desc) ly = pen.text(desc, mx + 4, ly, MWID - 4, body) + 2 * k;
      ly = bulletList(pen, bullets, mx + 4 * k, ly, MWID - 4 * k, { ...body, size: 8.6 }, 10, 2);
      ly += 9 * k;
    };
    const mainBlocks: Record<string, () => void> = {
      job: () => {
        if (!jobs.length) return;
        ly = head("Employment History", mx, ly);
        for (const j of jobs) entry([clean(j.title), [clean(j.company), clean(j.location)].filter(Boolean).join(", ")].filter(Boolean).join(" at "), jobDates(j), bulletsOf(j), clean(j.description));
        ly += 6 * k;
      },
      education: () => {
        if (!p.education?.length) return;
        ly = head("Education", mx, ly);
        for (const e of p.education) {
          const x = eduExtras(e);
          entry([clean(e.degree), [clean(e.school), clean(e.location)].filter(Boolean).join(", ")].filter(Boolean).join(" at "), eduDates(e), [], [x.honors, x.coursework].filter(Boolean).join("  |  "));
        }
        ly += 6 * k;
      },
      extras: () => {
        if (projectsOf(p).length) {
          ly = head("Projects", mx, ly);
          for (const j of projectsOf(p)) entry(clean(j.title), jobDates(j), bulletsOf(j), clean(j.description));
        }
        if (p.internships?.length) {
          ly = head("Internships", mx, ly);
          for (const j of p.internships) entry([clean(j.title), clean(j.company)].filter(Boolean).join(" at "), jobDates(j), bulletsOf(j), clean(j.description));
        }
        if (certs.length) {
          ly = head("Certifications", mx, ly);
          for (const c2 of certs) entry([c2.name, c2.issuer].filter(Boolean).join(", "), c2.year, []);
        }
      },
    };
    for (const id of orderOf(["job", "education", "extras"])) mainBlocks[id]?.();
    // the narrow column
    const details = contactList(p);
    if (details.length) {
      ry = head("Details", RX, ry);
      for (const d of details) {
        drawIcon(pen.doc, d.icon, RX, ry + 0.2 * k, 8 * k, NAVY);
        ry = pen.text(d.text, RX + 12 * k, ry, RW - 12 * k, { ...body, size: 8.6, color: INK, gap: 1.4 }) + 4 * k;
      }
      ry += 12 * k;
    }
    if (skills.length) {
      ry = head("Skills", RX, ry);
      for (const s of skills) {
        ry = pen.text(s.name, RX, ry, RW, { ...body, size: 8.6, color: INK, gap: 1.4 }) + 2.5 * k;
        if (s.level) {
          // a bar cut in five pieces, as many filled as the level
          const seg = (RW - 4 * 3 * k) / 5;
          for (let i = 0; i < 5; i++) pen.rect(RX + i * (seg + 3 * k), ry, seg, 3 * k, i < s.level ? NAVY : tint(base, 0.78));
          ry += 3 * k + 5 * k;
        } else ry += 3 * k;
      }
      ry += 10 * k;
    }
    if (langs.length) {
      ry = head("Languages", RX, ry);
      for (const l of langs) ry = pen.text(l.level ? `${l.name} (${L(l.level)})` : l.name, RX, ry, RW, { ...body, size: 8.6, color: INK, gap: 1.4 }) + 3.5 * k;
      ry += 10 * k;
    }
    if (ints.length) {
      ry = head("Interests", RX, ry);
      for (const it of ints) ry = pen.text(it, RX, ry, RW, { ...body, size: 8.6, color: INK, gap: 1.4 }) + 3.5 * k;
    }
    return;
  }

  /* ============================== ATELIER ============================== */
  {
    const SLATE = base;
    const SOFT = tint(base, 0.78);
    const mx = 40;
    const LW = 322;
    const RX = 395;
    const RW = W - 40 - RX;
    // the header: the monogram, a slash, the name in spaced capitals, then a line with the contact
    pen.rect(0, 0, W, 132 * k, tint(base, 0.82));
    const mono = initials ? `${initials.split("").join("  ")}  /` : "";
    let hx = mx;
    if (mono) {
      pen.text(mono, mx, 38 * k, 120, { font: sans, size: 26, color: SLATE, spacing: 4 });
      hx = mx + pen.widthOf(mono, { font: sans, size: 26, spacing: 4 }) + 16;
    }
    const upper = name.toUpperCase();
    const nw = W - 40 - hx;
    pen.text(upper, hx, 38 * k, nw, pen.fit(upper, { font: sans, size: 26, color: SLATE, spacing: 4 }, nw, 13));
    // the contact in one line (it wraps if it is long), each detail with its icon
    const cst: Style = { font: sans, size: 8.8, color: INK };
    let cx = mx;
    let cyy = 84 * k;
    for (const it of contactList(p)) {
      const tw = pen.widthOf(it.text, cst);
      if (cx > mx && cx + 12 * k + tw > W - mx) {
        cx = mx;
        cyy += 14 * k;
      }
      drawIcon(pen.doc, it.icon, cx, cyy + 0.2 * k, 8 * k, SLATE);
      pen.text(it.text, cx + 12 * k, cyy, tw + 6, { ...cst, gap: 0 });
      cx += 12 * k + tw + 16 * k;
    }
    if (role) pen.text(role, mx, cyy + 22 * k, W - 2 * mx, { font: sans, size: 9.6, color: SLATE, spacing: 1.2 });
    let ly = 160 * k;
    let ry = ly;
    const head = (title: string, x: number, yy: number, w: number) => {
      const bottom = pen.text(L(title).toUpperCase(), x, yy, w, { font: bold, size: 9.6, color: SLATE, spacing: 1.6 });
      pen.rule(x, bottom + 3 * k, x + w, SOFT, 1.2);
      return bottom + 3 * k + 9 * k;
    };
    const lentry = (org: string, sub: string, place: string, when: string, bullets: string[], desc = "") => {
      ly = pen.text([org, sub].filter(Boolean).join(" - "), mx, ly, LW, { font: bold, size: 9.4, color: INK, gap: 1 }) + 1.5 * k;
      if (place) ly = pen.text(place, mx, ly, LW, { font: sans, size: 8.4, color: MUTED, gap: 1 }) + 1 * k;
      if (when) ly = pen.text(when, mx, ly, LW, { font: sans, size: 8.4, color: MUTED, gap: 1 }) + 3 * k;
      if (desc) ly = pen.text(desc, mx, ly, LW, body) + 2 * k;
      ly = bulletList(pen, bullets, mx + 2 * k, ly, LW - 2 * k, { ...body, size: 8.6 }, 11, 2);
      ly += 11 * k;
    };
    const left: Record<string, () => void> = {
      about: () => {
        if (!summary) return;
        ly = head("Professional Summary", mx, ly, LW);
        ly = pen.text(summary, mx, ly, LW, { ...body, size: 9, color: INK, gap: 2.2 }) + 16 * k;
      },
      job: () => {
        if (!jobs.length) return;
        ly = head("Work history", mx, ly, LW);
        for (const j of jobs) lentry(clean(j.company), clean(j.title), clean(j.location), jobDates(j), bulletsOf(j), clean(j.description));
      },
      extras: () => {
        if (projectsOf(p).length) {
          ly = head("Projects", mx, ly, LW);
          for (const j of projectsOf(p)) lentry(clean(j.title), "", "", jobDates(j), bulletsOf(j), clean(j.description));
        }
        if (p.internships?.length) {
          ly = head("Internships", mx, ly, LW);
          for (const j of p.internships) lentry(clean(j.company), clean(j.title), clean(j.location), jobDates(j), bulletsOf(j), clean(j.description));
        }
      },
      languages: () => {
        if (!langs.length) return;
        ly = head("Languages", mx, ly, LW);
        const colW = LW / 3;
        langs.forEach((l, i) => {
          const x = mx + (i % 3) * colW;
          const yy = ly + Math.floor(i / 3) * 30 * k;
          pen.text(l.name, x, yy, colW - 6, { font: bold, size: 9, color: INK });
          if (l.level) pen.text(L(l.level), x, yy + 12 * k, colW - 6, { font: sans, size: 8.4, color: MUTED });
        });
        ly += Math.ceil(langs.length / 3) * 30 * k + 6 * k;
      },
    };
    const right: Record<string, () => void> = {
      skills: () => {
        if (!skills.length) return;
        ry = head("Skills", RX, ry, RW);
        ry = skillParagraphs(pen, p, RX, ry, RW, { ...body, font: bold, size: 8.8, color: INK, gap: 1 }, { ...body, size: 8.6, color: INK, gap: 1.8 }, 6) + 6 * k;
      },
      certs: () => {
        if (!certs.length) return;
        ry = head("Certifications", RX, ry, RW);
        ry = bulletList(pen, certs.map((c2) => [c2.name, c2.issuer, c2.year].filter(Boolean).join(" - ")), RX + 2 * k, ry, RW - 2 * k, { ...body, size: 8.6, color: INK }, 11, 3) + 12 * k;
      },
      interests: () => {
        if (!ints.length) return;
        ry = head("Interests", RX, ry, RW);
        ry = bulletList(pen, ints, RX + 2 * k, ry, RW - 2 * k, { ...body, size: 8.8, color: INK }, 11, 3) + 12 * k;
      },
      education: () => {
        if (!p.education?.length) return;
        ry = head("Education", RX, ry, RW);
        for (const e of p.education) {
          const x = eduExtras(e);
          ry = pen.text(clean(e.school) || clean(e.degree), RX, ry, RW, { font: bold, size: 9.2, color: INK, gap: 1 }) + 1.5 * k;
          if (clean(e.location)) ry = pen.text(clean(e.location), RX, ry, RW, { font: sans, size: 8.4, color: MUTED, gap: 1 }) + 1 * k;
          if (eduDates(e)) ry = pen.text(eduDates(e), RX, ry, RW, { font: sans, size: 8.4, color: MUTED, gap: 1 }) + 3 * k;
          if (clean(e.school) && clean(e.degree)) ry = pen.text(clean(e.degree), RX, ry, RW, { ...body, size: 8.8, color: INK }) + 2 * k;
          for (const t of [x.honors, x.coursework]) if (t) ry = pen.text(t, RX, ry, RW, { ...body, size: 8.2 }) + 2 * k;
          ry += 8 * k;
        }
      },
    };
    for (const id of orderOf(["about", "job", "extras", "languages"])) left[id]?.();
    for (const id of ["skills", "certs", "education", "interests"]) right[id]?.();
  }
}

function render(profile: ProfileData, template: ResumeTemplate, k: number, photo?: Buffer, lang: ResumeLang = "en", floor: number = FONT_FLOOR): Promise<Result> {
  droppedChars.clear();
  LANG = lang;
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

  if (template === "sidebar") {
    const panel = shade(accentHex("sidebar", profile.accentColor), 0.5);
    drawSidebarPanel(doc, panel);
    doc.on("pageAdded", () => drawSidebarPanel(doc, panel));
  }

  if (isGallery(template)) {
    const baseColor = accentHex(template, profile.accentColor);
    drawGalleryBack(doc, template, baseColor);
    doc.on("pageAdded", () => drawGalleryBack(doc, template, baseColor));
  }

  if (template === "essential") registerEssentialFonts(doc);
  const pen = new Pen(doc, k, floor);
  pen.photo = photo;
  pen.shape = photoShapeOf(template);
  if (template === "modern") drawModern(pen, profile);
  else if (template === "creative") drawCreative(pen, profile);
  else if (template === "essential") drawEssential(pen, profile);
  else if (template === "sidebar") drawSidebar(pen, profile);
  else if (template === "rirekisho") drawRirekisho(pen, profile);
  else if (template === "shokumu") drawShokumu(pen, profile);
  else if (template === "ats") drawAts(pen, profile);
  else if (isGallery(template)) drawGallery(pen, profile, template);
  else if (template === "executive" || template === "tech" || template === "minimal" || template === "elegant" || template === "timeline" || template === "legal" || template === "press" || template === "health" || template === "corporate" || template === "warm" || template === "academic" || template === "halftone" || template === "banner") drawSingle(pen, profile, template);
  else drawClassic(pen, profile);

  const pages = doc.bufferedPageRange().count;
  const dropped = Array.from(droppedChars);
  doc.flushPages();
  doc.end();
  return finished.then((buffer) => ({ buffer, pages, scale: pen.fk, dropped }));
}

/** The most the text may grow when there is little to say (the forms already fill the page). */
const GROW_SCALES = [1.3, 1.24, 1.18, 1.12, 1.06];
/** Blossom has room to spare, so its text may grow more. */
const GROW_SCALES_BLOSSOM = [1.5, 1.44, 1.38, 1.32, ...GROW_SCALES];

export async function renderResumeDetailed(
  rawProfile: ProfileData,
  template: string,
  options: { withPhoto?: boolean; lang?: ResumeLang } = {}
): Promise<ResumeRender> {
  // a job done for oneself reads "Self-employed" (or "Business (Self-employed)") where the company goes
  const profile = withSelfEmployed(rawProfile, options.lang ?? "en");
  const t: ResumeTemplate = asTemplate(template);
  const photo = options.withPhoto === false || !supportsPhoto(t) ? undefined : decodePhoto(profile.photo);
  let last: Result | null = null;
  // the forms and the two-column looks stay at their base size when there is little to say (only shrink when there is a lot)
  // (and a short resume keeps its natural size unless the person chose to fill the page)
  if (profile.fillPage === true && t !== "rirekisho" && t !== "shokumu" && t !== "modern" && t !== "creative" && t !== "sidebar" && (!isGallery(t) || t === "blossom")) {
    // little content: try bigger text first, the biggest that still fits on one page wins
    for (const k of t === "blossom" ? GROW_SCALES_BLOSSOM : GROW_SCALES) {
      const r = await render(profile, t, k, photo, options.lang);
      if (r.pages <= 1) return { buffer: r.buffer, scale: r.scale, pages: r.pages, droppedChars: r.dropped };
    }
  }
  // The text keeps a readable size and the spaces shrink first; if one page is still not enough the floor goes down a step (see FLOORS):
  // the resume is always ONE page. The size that fits is found by halving (the content only gets shorter as the scale goes down), so a
  // resume takes a handful of drawings, not dozens: the live preview depends on this being quick.
  const fitAt = async (floor: number): Promise<Result | null> => {
    // a scale above the floor draws the same as in the step before, so only the ones that can still change something are tried
    const ks = SCALES.filter((k) => floor === FONT_FLOOR || k <= floor);
    const biggest = await render(profile, t, ks[0], photo, options.lang, floor);
    last = biggest;
    if (biggest.pages <= 1) return biggest;
    const smallest = await render(profile, t, ks[ks.length - 1], photo, options.lang, floor);
    last = smallest;
    if (smallest.pages > 1) return null; // not even the smallest fits at this floor
    let lo = 0; // index that does not fit
    let hi = ks.length - 1; // index that fits
    let best = smallest;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      const r = await render(profile, t, ks[mid], photo, options.lang, floor);
      if (r.pages <= 1) {
        hi = mid;
        best = r;
      } else lo = mid;
    }
    return best;
  };
  for (const floor of FLOORS) {
    const found = await fitAt(floor);
    if (found) return { buffer: found.buffer, scale: found.scale, pages: found.pages, droppedChars: found.dropped };
  }
  return { buffer: last!.buffer, scale: last!.scale, pages: last!.pages, droppedChars: last!.dropped };
}

export async function renderResumePdf(profile: ProfileData, template: string, lang?: ResumeLang): Promise<Buffer> {
  return (await renderResumeDetailed(profile, template, { lang })).buffer;
}
