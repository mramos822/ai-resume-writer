/**
 * @jest-environment node
 */
import { ACCENTS, accentHex, accentIdFor, shade, supportsAccent, tint } from "@/lib/accents";
import { renderResumeDetailed } from "@/lib/pdfResume";
import type { ProfileData } from "@/context/profileContext";

describe("accent colors", () => {
  it("only the looks that have a color offer the choice", () => {
    for (const t of ["executive", "tech", "elegant", "timeline", "sidebar", "legal", "press", "health", "corporate", "warm"]) expect(supportsAccent(t)).toBe(true);
    for (const t of ["classic", "modern", "creative", "essential", "minimal", "nope", ""]) expect(supportsAccent(t)).toBe(false);
  });

  it("uses the choice when it is valid and the look's own color otherwise", () => {
    expect(accentIdFor("tech", "plum")).toBe("plum");
    expect(accentIdFor("tech", "not-a-color")).toBe("teal");
    expect(accentIdFor("executive", undefined)).toBe("navy");
    expect(accentHex("elegant", "emerald")).toBe(ACCENTS.find((a) => a.id === "emerald")!.hex);
  });

  it("makes lighter and darker versions of a color", () => {
    expect(tint("#000000", 1)).toBe("#ffffff");
    expect(tint("#336699", 0)).toBe("#336699");
    expect(shade("#ffffff", 1)).toBe("#000000");
  });

  it("draws every colored look with every color, on one page", async () => {
    const p = { name: "Sam Lee", jobTitle: "Engineer", contactInfo: { email: "s@x.com", phone: "5551234567", address: "NJ" }, skills: ["A", "B", "C"], careerObjective: "Builder.", jobHistory: [], education: [], languages: [], links: [] } as unknown as ProfileData;
    for (const t of ["executive", "tech", "elegant", "timeline", "sidebar", "legal", "press", "health", "corporate", "warm"]) {
      for (const a of ACCENTS) {
        const r = await renderResumeDetailed({ ...p, accentColor: a.id }, t);
        expect(r.pages).toBe(1);
      }
    }
  });
});
