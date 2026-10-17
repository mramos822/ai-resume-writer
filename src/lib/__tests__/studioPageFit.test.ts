import { evaluateAuto } from "@/lib/reviewRubric";
import type { ProfileData } from "@/context/profileContext";

const profile = {
  name: "Ana Perez",
  jobTitle: "Software Engineer",
  careerObjective: "Engineer.",
  skills: ["React"],
  jobHistory: [{ id: "j", title: "Dev", company: "Acme", startDate: "2020-01", endDate: "", current: true, description: "", accomplishments: ["Built things for 30% more speed"] }],
  education: [{ id: "e", school: "State", degree: "BS", startDate: "2012-09", endDate: "2016-05" }],
  internships: [],
  projects: [],
  contactInfo: { email: "a@b.c", phone: "5551234567", address: "NYC" },
} as unknown as ProfileData;

const onePage = (fit: Parameters<typeof evaluateAuto>[1]) => evaluateAuto(profile, fit, "modern").find((c) => c.id === "onePage");

describe("the page filter in the studio, from the size the saved file was made at", () => {
  it("says nothing about the page when the file has no saved size (old files)", () => {
    expect(onePage(null)).toBeUndefined();
  });

  it("passes a resume that fits at a comfortable size", () => {
    expect(onePage({ pages: 1, scale: 1, maxPages: 1 })?.verdict).toBe("pass");
  });

  it("fails a resume whose text had to shrink to small print", () => {
    const r = onePage({ pages: 1, scale: 0.6, maxPages: 1 });
    expect(r?.verdict).toBe("fail");
    expect(r?.reason).toMatch(/very small/i);
  });

  it("is a partial when the text is only a little small", () => {
    expect(onePage({ pages: 1, scale: 0.78, maxPages: 1 })?.verdict).toBe("partial");
  });
});
