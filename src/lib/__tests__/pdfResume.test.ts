/**
 * @jest-environment node
 */
import { renderResumeDetailed } from "@/lib/pdfResume";
import type { ProfileData } from "@/context/profileContext";

const job = (n: number) => ({
  id: String(n),
  company: `Company ${n}`,
  title: "Programmer",
  description: "",
  startDate: "2015-12",
  endDate: "",
  current: true,
  accomplishments: [
    "Worked to enhance software systems to help educators, scientists and policy experts already working on some of humanity's greatest challenges.",
    "Developed and enhanced programs to increase accuracy and lower costs.",
    "Handled debugging and testing to a high success rate.",
  ],
});

const base: ProfileData = {
  name: "Taylor Cook",
  jobTitle: "Software Engineer",
  contactInfo: { email: "taylor@example.com", phone: "(315) 802-8179", address: "Palo Alto, CA" },
  careerObjective: "Innovative programmer who likes building useful things.",
  skills: ["Performance Optimization", "Scripting", "Software Design"],
  jobHistory: [job(1), job(2)],
  education: [{ id: "e", school: "Boston College", degree: "MSc Computer Science", startDate: "2001-08", endDate: "2004-06" }],
  internships: [{ ...job(3), title: "Intern" }],
  projects: [
    {
      id: "p",
      name: "Budget Tracker",
      description: "Web app to track spending.",
      technologies: ["React", "Node.js"],
      startDate: "",
      endDate: "",
      accomplishments: ["Used by 200+ students."],
    },
  ],
};

/** Counts PDF page objects (`/Type /Page`, but not `/Type /Pages`). */
const pageCount = (buf: Buffer) => (buf.toString("latin1").match(/\/Type \/Page(?!s)/g) ?? []).length;

describe.each(["modern", "classic", "creative"])("%s template", (template) => {
  it("produces a valid one-page PDF at normal size for a typical resume", async () => {
    const r = await renderResumeDetailed(base, template);
    expect(r.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(r.pages).toBe(1);
    expect(pageCount(r.buffer)).toBe(1);
    expect(r.scale).toBe(1);
  });

  it("shrinks a very long resume to keep it on a single page", async () => {
    const long = { ...base, jobHistory: Array.from({ length: 8 }, (_, i) => job(i + 1)) };
    const r = await renderResumeDetailed(long, template);
    expect(pageCount(r.buffer)).toBe(1);
    expect(r.scale).toBeLessThan(1);
  });

  it("reports characters the built-in fonts cannot draw", async () => {
    const r = await renderResumeDetailed({ ...base, name: "Тейлор Cook" }, template);
    expect(r.droppedChars).toContain("Т");
  });

  it("works with an almost empty profile", async () => {
    const r = await renderResumeDetailed(
      { ...base, careerObjective: "", skills: [], jobHistory: [], education: [], internships: [], projects: [] },
      template
    );
    expect(pageCount(r.buffer)).toBe(1);
  });
});

it("falls back to the classic layout for an unknown template name", async () => {
  const r = await renderResumeDetailed(base, "does-not-exist");
  expect(pageCount(r.buffer)).toBe(1);
});
