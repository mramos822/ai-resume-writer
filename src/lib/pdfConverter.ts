// PDF to DOCX. The resumes are stored as PDF, so the Word version is rebuilt from the text of the PDF: every line keeps its size and bold,
// bullets become hanging-indent paragraphs, lines that were wrapped inside a bullet or a paragraph are joined again, columns (a date on the
// right, a sidebar) are separated with a right tab, and each PDF page starts on a new page. It is a real, editable .docx (a zip of XML files)
// that Word, Google Docs and Pages open. The look is close to the PDF, not identical: the PDF stays the exact copy.

import JSZip from "jszip";

export type Part = { x: number; str: string; size: number; bold: boolean; end?: number; color?: string; spacing?: number; family?: "sans" | "serif" | "mono" };
export type Line = { y: number; page: number; parts: Part[]; pageW?: number; pageH?: number };
type Para = { text: Part[]; size: number; bullet: boolean; tab: boolean; center: boolean; pageBreak: boolean; y: number; gapBefore: number };

const BULLETS = /^[•●▪◦·■▸►‣⁃\-–—*]\s*/;
const BOLD_FONT = /bold|black|heavy|semibold|demi/i;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

// Section titles of the resumes this app makes (English and Spanish) and the little words between them, used to put the spaces back in a
// letter-spaced title: the PDF draws "PROFILE" with room between the letters, and PDF readers give that back as "P R O F I L E".
const TITLE_WORDS = [
  "PROFILE", "SUMMARY", "OBJECTIVE", "CAREER", "EMPLOYMENT", "HISTORY", "EXPERIENCE", "WORK", "PROFESSIONAL", "EDUCATION", "SKILLS", "PROJECTS",
  "INTERNSHIPS", "LANGUAGES", "LINKS", "CERTIFICATIONS", "CERTIFICATES", "AWARDS", "REFERENCES", "CONTACT", "TECHNICAL", "ABOUT", "ME", "AND", "OF",
  "PERFIL", "RESUMEN", "OBJETIVO", "EXPERIENCIA", "LABORAL", "PROFESIONAL", "EDUCACIÓN", "FORMACIÓN", "HABILIDADES", "COMPETENCIAS", "PROYECTOS",
  "PRÁCTICAS", "IDIOMAS", "ENLACES", "CERTIFICACIONES", "CONTACTO", "HISTORIAL", "ACADÉMICA", "DE", "Y", "SOBRE", "MÍ",
];

/** "P R O F I L E" -> "PROFILE", "TAY L O R C O O K" -> "TAYLOR COOK" (the words come from `vocab`: titles and the words of the resume's file name).
 *  Text that is not letter-spaced, or that cannot be split into known words, is returned as it is, except that the extra spaces go. */
export function closeUpLetters(text: string, vocab: string[]): string {
  const tokens = text.trim().split(/\s+/);
  const singles = tokens.filter((t) => [...t].length === 1).length;
  if (tokens.length < 4 || singles < tokens.length * 0.6 || tokens.some((t) => [...t].length > 3)) return text;
  const squashed = tokens.join("");
  const upper = squashed.toUpperCase();
  const words = new Set([...TITLE_WORDS, ...vocab.map((w) => w.toUpperCase())]);
  // fewest words that cover the whole text
  const best: (string[] | null)[] = Array(upper.length + 1).fill(null);
  best[0] = [];
  for (let i = 1; i <= upper.length; i++) {
    for (let j = Math.max(0, i - 24); j < i; j++) {
      const before = best[j];
      if (before && words.has(upper.slice(j, i)) && (!best[i] || before.length + 1 < best[i]!.length)) best[i] = [...before, squashed.slice(j, i)];
    }
  }
  return best[upper.length] ? best[upper.length]!.join(" ") : squashed;
}

async function readLines(pdf: Buffer, vocab: string[] = []): Promise<Line[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise;
  const lines: Line[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      // the fonts of the page are only known once its drawing operations have been read; the same operations tell the color and the
      // letter spacing every piece of text is drawn with
      const ops = await page.getOperatorList().catch(() => undefined);
      const drawn: { x: number; y: number; color: string; spacing: number }[] = [];
      if (ops) {
        const O = pdfjs.OPS;
        let color = "#000000";
        let spacing = 0;
        let tx = 0;
        let ty = 0;
        const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);
        for (let i = 0; i < ops.fnArray.length; i++) {
          const fn = ops.fnArray[i];
          const a = ops.argsArray[i] as unknown[] | null;
          if (fn === O.setFillRGBColor) color = hex(a?.[0]) ?? color;
          else if (fn === O.setFillGray) {
            const g = hex(a?.[0]);
            if (g) color = g;
          } else if (fn === O.setCharSpacing) spacing = Number(a?.[0]) || 0;
          else if (fn === O.beginText) spacing = 0;
          else if (fn === O.setTextMatrix) {
            const m = a?.[0] as ArrayLike<number> | undefined;
            if (m) {
              tx = Number(m[4]);
              ty = Number(m[5]);
            }
          } else if (fn === O.showText || fn === O.showSpacedText) drawn.push({ x: tx, y: ty, color, spacing });
        }
      }
      const styleAt = (x: number, y: number) => {
        let best: (typeof drawn)[number] | undefined;
        for (const d of drawn) if (Math.abs(d.y - y) < 0.8 && d.x <= x + 0.8 && (!best || d.x > best.x)) best = d;
        return best;
      };
      const [, , pageW, pageH] = page.view as number[];
      const content = await page.getTextContent();
      const fontCache = new Map<string, { bold: boolean; family: "sans" | "serif" | "mono" }>();
      const fontOf = (fontName: string) => {
        if (fontCache.has(fontName)) return fontCache.get(fontName)!;
        let info: { bold: boolean; family: "sans" | "serif" | "mono" } = { bold: false, family: "sans" };
        try {
          const font = page.commonObjs.get(fontName) as { name?: string } | undefined;
          const n = font?.name ?? "";
          info = { bold: BOLD_FONT.test(n), family: /courier|mono/i.test(n) ? "mono" : /times|serif|georgia|garamond|palatino/i.test(n) && !/sans/i.test(n) ? "serif" : "sans" };
        } catch {
          /* font not loaded: plain */
        }
        fontCache.set(fontName, info);
        return info;
      };
      const rows: Line[] = [];
      for (const it of content.items as { str?: string; transform?: number[]; height?: number; width?: number; fontName?: string }[]) {
        if (!it.str || !it.str.trim() || !it.transform) continue;
        const size = Math.abs(it.height || it.transform[3] || 10);
        const y = it.transform[5];
        let row = rows.find((r) => Math.abs(r.y - y) <= Math.max(2, size * 0.3));
        if (!row) {
          row = { y, page: n, parts: [], pageW, pageH };
          rows.push(row);
        }
        const st = styleAt(it.transform[4], y);
        const font = fontOf(it.fontName ?? "");
        row.parts.push({
          x: it.transform[4],
          str: closeUpLetters(it.str, vocab),
          size,
          bold: font.bold,
          family: font.family,
          color: st && st.color !== "#000000" ? st.color : undefined,
          spacing: st && st.spacing > 0.05 ? st.spacing : undefined,
          end: it.width ? it.transform[4] + it.width : undefined,
        });
      }
      rows.sort((a, b) => b.y - a.y); // the top of a PDF page has the biggest y
      for (const r of rows) r.parts.sort((a, b) => a.x - b.x);
      lines.push(...rows);
    }
  } finally {
    await doc.destroy().catch(() => {});
  }
  return lines;
}

/** How big a gap between two pieces must be to count as a space. Letter-spaced headings ("P R O F I L E" drawn with extra room between the
 * letters) come out of the PDF as one piece per letter, so there the usual gap between letters is measured and only a clearly bigger one is a space. */
function wordGap(parts: Part[]): number {
  const size = Math.max(...parts.map((p) => p.size));
  const normal = size * 0.22;
  if (parts.length < 4) return normal;
  const short = parts.filter((p) => p.str.trim().length <= 2).length;
  if (short < parts.length * 0.6) return normal;
  const gaps: number[] = [];
  for (let i = 1; i < parts.length; i++) {
    const prev = parts[i - 1];
    gaps.push(parts[i].x - (prev.end ?? prev.x + prev.str.length * prev.size * 0.5));
  }
  gaps.sort((a, b) => a - b);
  const typical = gaps[Math.floor(gaps.length / 2)];
  return Math.max(normal, typical + size * 0.22);
}

/** Turns the lines of the PDF into paragraphs: bullets, joined wrapped lines, right-aligned columns. */
function toParagraphs(lines: Line[]): Para[] {
  const paras: Para[] = [];
  let prev: Line | null = null;
  for (const line of lines) {
    // pieces of one line: neighbours that touch are one run; a big gap is a column, kept apart by a tab
    const merged: Part[] = [];
    let tab = false;
    const space = wordGap(line.parts);
    for (const p of line.parts) {
      const last = merged[merged.length - 1];
      if (last) {
        const end = last.end ?? last.x + last.str.length * last.size * 0.5;
        if (p.x - end > p.size * 2) {
          tab = true;
          merged.push({ ...p, str: "\t" + p.str });
          continue;
        }
        if (last.bold === p.bold && last.color === p.color && last.family === p.family && Math.abs(last.size - p.size) < 0.6) {
          last.str += (p.x - end > space && !last.str.endsWith(" ") && !p.str.startsWith(" ") ? " " : "") + p.str;
          last.end = p.end;
          continue;
        }
        merged.push({ ...p, str: (p.x - end > space && !last.str.endsWith(" ") && !p.str.startsWith(" ") ? " " : "") + p.str });
        continue;
      }
      merged.push({ ...p });
    }
    const size = Math.max(...merged.map((p) => p.size));
    const first = merged[0];
    // a dash or dot drawn in its own color (Minimal's grey dashes) comes as a piece of its own
    const bullet = /^[•●▪◦■▸►‣⁃]/.test(first.str) || /^[-–—*]\s+/.test(first.str) || (merged.length > 1 && /^[-–—*]$/.test(first.str.trim()));
    if (bullet) {
      first.str = first.str.replace(BULLETS, "");
      if (!first.str && merged.length > 1) {
        merged.shift();
        merged[0].str = merged[0].str.replace(/^\s+/, "");
      }
    }
    const newPage = !prev || prev.page !== line.page;
    // a line whose middle is the middle of the page (and that does not start at the left margin) was centered
    const left = Math.min(...line.parts.map((p) => p.x));
    const right = Math.max(...line.parts.map((p) => p.end ?? p.x));
    const center = !!line.pageW && !tab && Math.abs((left + right) / 2 - line.pageW / 2) < 5 && left > 80;
    const gap = prev && !newPage ? prev.y - line.y : 0;
    const before = paras[paras.length - 1];
    // a line that continues the one above: same size, close below, not a bullet, no columns, and the one above is a bullet or plain text
    const continues =
      !!before && !newPage && !bullet && !tab && !before.tab && Math.abs(before.size - size) < 0.6 && gap > 0 && gap < size * 1.7 && !merged.every((p) => p.bold) && !before.text.every((p) => p.bold);
    if (continues) {
      const lastPart = before.text[before.text.length - 1];
      merged[0].str = (lastPart.str.endsWith(" ") ? "" : " ") + merged[0].str.replace(/^\s+/, "");
      before.text.push(...merged);
    } else {
      paras.push({ text: merged, size, bullet, tab, center, pageBreak: newPage && paras.length > 0, y: line.y, gapBefore: gap });
    }
    prev = line;
  }
  return paras;
}

const run = (p: Part) => {
  const parts = p.str.split("\t");
  const sz = Math.max(14, Math.min(80, Math.round(p.size * 2)));
  const face = p.family === "serif" ? "Times New Roman" : p.family === "mono" ? "Courier New" : "Arial";
  const props =
    `<w:rPr><w:rFonts w:ascii="${face}" w:hAnsi="${face}" w:cs="${face}"/>${p.bold ? "<w:b/>" : ""}` +
    (p.color ? `<w:color w:val="${p.color.slice(1).toUpperCase()}"/>` : "") +
    (p.spacing ? `<w:spacing w:val="${Math.round(p.spacing * 20)}"/>` : "") +
    `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`;
  return parts.map((t, i) => `${i > 0 ? `<w:r>${props}<w:tab/></w:r>` : ""}${t ? `<w:r>${props}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>` : ""}`).join("");
};

function paragraphXml(p: Para, tabAt: number): string {
  // the room the PDF leaves above a line, beyond the height of the line itself
  const before = p.gapBefore > p.size * 1.7 ? Math.min(560, Math.round((p.gapBefore - p.size * 1.25) * 20)) : 0;
  const ppr =
    "<w:pPr>" +
    (p.pageBreak ? "<w:pageBreakBefore/>" : "") +
    (p.tab ? `<w:tabs><w:tab w:val="right" w:pos="${tabAt}"/></w:tabs>` : "") +
    `<w:spacing w:before="${before}" w:after="${p.bullet ? 20 : 40}"/>` +
    (p.bullet ? '<w:ind w:left="360" w:hanging="260"/>' : "") +
    (p.center ? '<w:jc w:val="center"/>' : "") +
    "</w:pPr>";
  const bullet = p.bullet ? `<w:r><w:t xml:space="preserve">•  </w:t></w:r>` : "";
  return `<w:p>${ppr}${bullet}${p.text.map(run).join("")}</w:p>`;
}

/** `hints` are words that may appear letter-spaced (the name on the resume: take them from the file name). */
export async function convertPdfToDocx(pdfBuffer: Buffer, hints: string[] = []): Promise<Buffer> {
  return docxFromLines(await readLines(pdfBuffer, hints));
}

/** The second half of the conversion, apart from reading the PDF so it can be tested with lines written by hand. */
export async function docxFromLines(lines: Line[]): Promise<Buffer> {
  const paras = toParagraphs(lines);
  if (paras.length === 0) throw new Error("The PDF has no text to convert");

  // the sheet has the size of the PDF's page and its margins (the left margin is where the text starts; the right one is where it ends)
  const pageW = lines.find((l) => l.pageW)?.pageW ?? 612;
  const pageH = lines.find((l) => l.pageH)?.pageH ?? 792;
  const xs = lines.flatMap((l) => l.parts.map((p) => p.x));
  const ends = lines.flatMap((l) => l.parts.map((p) => p.end ?? p.x));
  const clampTw = (pt: number) => Math.max(360, Math.min(1800, Math.round(pt * 20)));
  const marginL = clampTw(Math.min(...xs));
  const marginR = clampTw(pageW - Math.max(...ends));
  const widthTw = Math.round(pageW * 20);
  const tabAt = widthTw - marginL - marginR;
  const body = paras.map((p) => paragraphXml(p, tabAt)).join("");
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    "word/_rels/document.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="40" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="${widthTw}" w:h="${Math.round(pageH * 20)}"/><w:pgMar w:top="720" w:right="${marginR}" w:bottom="720" w:left="${marginL}" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
