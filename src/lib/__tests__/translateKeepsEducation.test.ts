/** @jest-environment node */
import { applyTexts, translatableTexts } from "@/lib/resumeTranslate";

const p = {
  jobTitle: "Software Engineer",
  careerObjective: "Engineer who builds web apps.",
  education: [{ id: "e", school: "New Jersey Institute of Technology", degree: "BS Computer Science", honors: "Cum laude" }],
  skills: ["React", "Teamwork"],
} as never;

describe("translating a resume", () => {
  it("never sends the degree or the school, and never changes them", () => {
    const texts = translatableTexts(p);
    expect(texts).not.toContain("BS Computer Science");
    expect(texts).not.toContain("New Jersey Institute of Technology");
    // a translation that answers something for every position (even for the two kept empty) leaves the degree and the school as they are
    const back = applyTexts(p, texts.map((t) => (t ? `ES:${t}` : "INVENTED")));
    const edu = (back.education ?? [])[0];
    expect(edu.degree).toBe("BS Computer Science");
    expect(edu.school).toBe("New Jersey Institute of Technology");
    expect(edu.honors).toBe("ES:Cum laude");
  });
});
