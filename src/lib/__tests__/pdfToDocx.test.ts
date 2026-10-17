/**
 * @jest-environment node
 */
import JSZip from "jszip";
import { docxFromLines, closeUpLetters, type Line } from "@/lib/pdfConverter";

// Lines as they come out of a PDF page (y grows upwards): name, contact line with a date column, a section title, a bullet that wraps, a second page.
const line = (page: number, y: number, ...parts: [number, string, number, boolean][]): Line => ({
  page,
  y,
  parts: parts.map(([x, str, size, bold]) => ({ x, str, size, bold })),
});

const lines: Line[] = [
  line(1, 760, [200, "TAYLOR COOK", 20, true]),
  line(1, 740, [40, "taylor@example.com", 10, false], [450, "Palo Alto, CA", 10, false]),
  line(1, 700, [40, "EMPLOYMENT HISTORY", 12, true]),
  line(1, 680, [40, "Programmer, Company 1", 11, true], [450, "Dec 2015 - Present", 10, false]),
  line(1, 664, [40, "•", 10, false], [52, "Worked to enhance software systems to help educators and scientists already", 10, false]),
  line(1, 652, [52, "working on some of humanity's greatest challenges.", 10, false]),
  line(1, 636, [40, "•", 10, false], [52, "Handled debugging & testing <fast>.", 10, false]),
  line(2, 760, [40, "EDUCATION", 12, true]),
  line(2, 744, [40, "Boston College", 11, true], [450, "2001 - 2004", 10, false]),
];

describe("PDF to DOCX", () => {
  it("makes a real .docx (a zip) with the parts Word needs", async () => {
    const docx = await docxFromLines(lines);
    expect(docx.subarray(0, 2).toString()).toBe("PK");
    const zip = await JSZip.loadAsync(docx);
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml"]));
  });

  it("keeps the text, the bold and the bullets", async () => {
    const xml = await (await JSZip.loadAsync(await docxFromLines(lines))).file("word/document.xml")!.async("string");
    const text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(text).toContain("TAYLOR COOK");
    expect(text).toContain("Programmer, Company 1");
    expect(text).toContain("Boston College");
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("•");
  });

  it("joins a bullet that was wrapped over two lines and keeps the next bullet apart", async () => {
    const xml = await (await JSZip.loadAsync(await docxFromLines(lines))).file("word/document.xml")!.async("string");
    const text = xml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
    expect(text).toContain("already working on some of humanity's greatest challenges.");
    expect(xml.match(/<w:ind w:left="360"/g)).toHaveLength(2); // two bullets, not three paragraphs
  });

  it("puts a date column on the right with a tab, and starts the second page on a new page", async () => {
    const xml = await (await JSZip.loadAsync(await docxFromLines(lines))).file("word/document.xml")!.async("string");
    expect(xml).toContain('<w:tab w:val="right"');
    expect(xml.match(/<w:pageBreakBefore\/>/g)).toHaveLength(1);
  });

  it("escapes characters XML cannot hold", async () => {
    const xml = await (await JSZip.loadAsync(await docxFromLines(lines))).file("word/document.xml")!.async("string");
    expect(xml).toContain("Handled debugging &amp; testing &lt;fast&gt;.");
    expect(xml).not.toContain("<fast>");
  });

  it("puts the spaces back in letter-spaced titles and names", () => {
    expect(closeUpLetters("P R O F I L E", [])).toBe("PROFILE");
    expect(closeUpLetters("E M P L OY M E N T H I S T O R Y", [])).toBe("EMPLOYMENT HISTORY");
    expect(closeUpLetters("TAY L O R C O O K", ["Taylor", "Cook"])).toBe("TAYLOR COOK");
    expect(closeUpLetters("P E R F I L", [])).toBe("PERFIL");
  });

  it("leaves normal text alone", () => {
    expect(closeUpLetters("Programmer, Company 1", [])).toBe("Programmer, Company 1");
    expect(closeUpLetters("Java Developer", [])).toBe("Java Developer");
    expect(closeUpLetters("A B", [])).toBe("A B");
  });

  it("refuses an empty PDF instead of making an empty file", async () => {
    await expect(docxFromLines([])).rejects.toThrow();
  });
});
