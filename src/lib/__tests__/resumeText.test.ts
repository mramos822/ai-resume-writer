import { cleanExtractedText, extractJsonObject } from "@/lib/resumeText";

describe("reading a resume file", () => {
  it("composes accents that a PDF split apart", () => {
    expect(cleanExtractedText("Müller, Größe")).toBe("Müller, Größe");
  });
  it("joins a word broken at the end of a line and drops ligatures", () => {
    expect(cleanExtractedText("Berufs-\nerfahrung ﬁnanz")).toBe("Berufserfahrung finanz");
  });
  it("finds the JSON in an answer with fences or words around it", () => {
    expect(extractJsonObject('Hier ist es:\n```json\n{"a":1}\n```\nFertig.')).toBe('{"a":1}');
    expect(extractJsonObject("nothing here")).toBeNull();
  });
});
