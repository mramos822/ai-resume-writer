/**
 * @jest-environment node
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { renderResumeDetailed, maxPagesFor } from "@/lib/pdfResume";
import type { ProfileData } from "@/context/profileContext";

const job = (n: number) => ({
  id: String(n),
  company: `Company ${n}`,
  title: "Programmer",
  description: "",
  startDate: "2015-12",
  endDate: n === 1 ? "" : "2019-05",
  current: n === 1,
  accomplishments: [
    "Worked to enhance software systems to help educators, scientists and policy experts already working on some of humanity's greatest challenges.",
    "Developed and enhanced programs to increase accuracy and lower costs.",
    "Handled debugging and testing to a high success rate.",
    "Led a small team through two releases and wrote the documentation the new people used to learn the system.",
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
  internships: [],
  projects: [],
};

const pageCount = (buf: Buffer) => (buf.toString("latin1").match(/\/Type \/Page(?!s)/g) ?? []).length;
const jobs = (n: number) => Array.from({ length: n }, (_, i) => job(i + 1));
const dump = (name: string, buf: Buffer) => {
  if (process.env.KAIZO_DUMP) writeFileSync(join(process.env.KAIZO_DUMP, name), buf);
};

describe("maxPagesFor", () => {
  it("is one page unless the person accepts more and the look can do it", () => {
    expect(maxPagesFor({}, "classic")).toBe(1);
    expect(maxPagesFor({ pageGoal: "one" }, "classic")).toBe(1);
    expect(maxPagesFor({ pageGoal: "two" }, "classic")).toBe(2);
    expect(maxPagesFor({ pageGoal: "any" }, "ats")).toBe(2);
    expect(maxPagesFor({ pageGoal: "two" }, "modern")).toBe(1);
    // the looks made for one sheet stay on one, whatever the person prefers
    for (const look of ["modern", "creative", "sidebar", "banner", "rirekisho", "noir", "blossom", "pastel", "atelier"]) expect(maxPagesFor({ pageGoal: "two" }, look)).toBe(1);
    for (const look of ["modern", "creative", "sidebar", "banner"]) expect(maxPagesFor({ pageGoal: "any" }, look)).toBe(1);
    expect(maxPagesFor({ pageGoal: "two" }, "shokumu")).toBe(2);
  });
});

describe.each(["classic", "ats"])("%s over two pages", (template) => {
  it("keeps one page for a short resume even when two are accepted", async () => {
    const r = await renderResumeDetailed({ ...base, pageGoal: "two" }, template);
    expect(r.pages).toBe(1);
    expect(r.maxPages).toBe(2);
    expect(pageCount(r.buffer)).toBe(1);
  });

  it("runs onto a second page at normal size instead of shrinking", async () => {
    const long = { ...base, jobHistory: jobs(10) };
    const one = await renderResumeDetailed(long, template);
    const two = await renderResumeDetailed({ ...long, pageGoal: "two" }, template);
    dump(`${template}-two.pdf`, two.buffer);
    expect(one.pages).toBe(1);
    expect(one.scale).toBeLessThan(1);
    expect(two.pages).toBe(2);
    expect(pageCount(two.buffer)).toBe(2);
    expect(two.scale).toBe(1);
  });

  it("still shrinks when even two pages are not enough", async () => {
    const r = await renderResumeDetailed({ ...base, jobHistory: jobs(30), pageGoal: "two" }, template);
    expect(r.pages).toBeLessThanOrEqual(2);
    expect(pageCount(r.buffer)).toBeLessThanOrEqual(2);
    expect(r.scale).toBeLessThan(1);
  });
});

it("a look that cannot run to two pages stays on one", async () => {
  const r = await renderResumeDetailed({ ...base, jobHistory: jobs(10), pageGoal: "two" }, "modern");
  expect(r.maxPages).toBe(1);
  expect(r.pages).toBe(1);
  expect(pageCount(r.buffer)).toBe(1);
});

describe("let Kaizo decide", () => {
  it("keeps one page, at a comfortable size, when everything fits", async () => {
    const r = await renderResumeDetailed({ ...base, jobHistory: jobs(8), pageGoal: "any" }, "classic");
    expect(r.pages).toBe(1);
    expect(r.scale).toBeGreaterThanOrEqual(0.9);
    expect(pageCount(r.buffer)).toBe(1);
  });

  it("goes to two pages, at normal size, instead of shrinking the text below comfortable", async () => {
    const r = await renderResumeDetailed({ ...base, jobHistory: jobs(14), pageGoal: "any" }, "classic");
    expect(r.pages).toBe(2);
    expect(r.scale).toBe(1);
    expect(pageCount(r.buffer)).toBe(2);
  });

  it("stays on one page for a look that cannot do two", async () => {
    const r = await renderResumeDetailed({ ...base, jobHistory: jobs(14), pageGoal: "any" }, "modern");
    expect(r.pages).toBe(1);
    expect(r.maxPages).toBe(1);
  });
});

describe("Modern, Creative, Sidebar and Banner are always a single sheet", () => {
  it.each(["modern", "creative", "sidebar", "banner"])("%s shrinks a very long resume to one sheet, whatever page goal is set", async (look) => {
    for (const goal of ["one", "two", "any"] as const) {
      const r = await renderResumeDetailed({ ...base, jobHistory: jobs(14), pageGoal: goal }, look);
      expect(r.maxPages).toBe(1);
      expect(r.pages).toBe(1);
      expect(pageCount(r.buffer)).toBe(1);
    }
  });
});

describe.each(["shokumu"])("%s over two pages", (look) => {
  it("runs onto a second sheet at normal size and keeps a second sheet worth having", async () => {
    const r = await renderResumeDetailed({ ...base, jobHistory: jobs(look === "shokumu" ? 8 : 10), pageGoal: "two" }, look);
    expect(r.pages).toBe(2);
    expect(r.scale).toBe(1);
    expect(pageCount(r.buffer)).toBe(2);
    expect(r.lastFill ?? 0).toBeGreaterThan(0.2);
  });
});

it("every look that can run to two pages renders both ways without crashing (Essential needs its own fonts)", async () => {
  const { TWO_PAGE_TEMPLATES } = await import("@/lib/pageGoal");
  for (const look of TWO_PAGE_TEMPLATES) {
    for (const goal of ["one", "two", "any"] as const) {
      const r = await renderResumeDetailed({ ...base, jobHistory: jobs(12), pageGoal: goal }, look);
      expect(r.buffer.subarray(0, 5).toString()).toBe("%PDF-");
      expect(r.pages).toBeLessThanOrEqual(goal === "one" ? 1 : 2);
    }
  }
});
