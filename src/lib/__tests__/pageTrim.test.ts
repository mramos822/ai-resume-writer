/** @jest-environment node */
jest.mock("@/lib/openaiClient", () => ({ getOpenAIChatCompletion: jest.fn() }));
jest.mock("@/lib/aiConfig", () => ({ AI_MODEL: "test" }));

import { trimToFit } from "@/lib/pageTrim";
import { renderResumeDetailed } from "@/lib/pdfResume";
import { passesPage } from "@/lib/pageRules";
import type { JobListing } from "@/lib/jobSearch";
import type { ProfileData } from "@/context/profileContext";

jest.setTimeout(120000);

const bullets = ["Built and maintained customer facing web pages with React and TypeScript for several teams", "Reduced the page load time from four seconds to two seconds by lazy loading images and caching", "Led the migration of the billing service to a new database with zero downtime for customers", "Wrote automated tests that cut the number of production bugs by a third over two quarters"];
const job = (i: number) => ({ id: `j${i}`, title: `Web Developer ${i}`, company: `Company ${i}`, location: "NYC", startDate: `${2024 - i * 2}-01`, endDate: `${2025 - i * 2}-01`, current: i === 0, description: "", accomplishments: bullets });
const posting: JobListing = { key: "k", source: "link", title: "Software Engineer", company: "Acme", location: "", remote: true, url: "", postedAt: "", tags: [], snippet: "React, Node.js", description: "React, Node.js" };

const base = (skills: string[], jobs: number) =>
  ({
    name: "Ana Perez",
    jobTitle: "Software Engineer",
    careerObjective: "Software engineer who turns messy problems into simple tools and ships reliable features for thousands of people every week.",
    skills,
    jobHistory: Array.from({ length: jobs }, (_, i) => job(i)),
    education: [{ id: "e", school: "State University", degree: "BS Computer Science", startDate: "2012-09", endDate: "2016-05", current: false }],
    internships: [],
    projects: [],
    languages: [],
    contactInfo: { email: "a@b.c", phone: "5551234567", address: "NYC" },
  }) as unknown as ProfileData;

describe("making a resume pass the page filter", () => {
  it("leaves a resume that already fits as it is", async () => {
    const p = base(["React", "Node.js", "SQL", "Git", "Docker", "AWS", "Python", "Java"], 2);
    const r = await trimToFit(p, posting, "classic", "en");
    expect(r.steps).toEqual([]);
    expect(r.profile).toBe(p);
  });

  it("takes skills out too, only the repeated and least needed ones, when the list is very long", async () => {
    const own = ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "Docker", "AWS", "Git", "Jira", "Python", "Java", "MongoDB", "Redis", "Linux", "Kubernetes", "GitHub", "GitHub Actions", "Teamwork", "Microsoft Office", "Trello", "Slack", "Notion", "Zoom", "Confluence", "Asana", "Figma", "Postman", "Terraform", "Ansible", "Jenkins"];
    // ninety skills on three jobs: too much for one page even when the spaces shrink first and the text stays at a readable size
    const skills = [...own, ...own.map((x) => `${x} Pro`), ...own.map((x) => `${x} Plus`)];
    const crowded = base(skills, 3);
    const before = await renderResumeDetailed(crowded, "classic", {});
    expect(passesPage({ pages: before.pages, scale: before.scale })).toBe(false);

    const r = await trimToFit(crowded, posting, "classic", "en", ["Figma"]);
    const after = await renderResumeDetailed(r.profile, "classic", {});
    expect(passesPage({ pages: after.pages, scale: after.scale })).toBe(true);
    expect(r.steps.some((s) => s.id === "reviewSkills")).toBe(true);
    expect((r.profile.skills ?? []).length).toBeLessThan(skills.length);
    // what the job asks for, the career's own knowledge and what the person confirmed stay; the three jobs stay
    for (const keep of ["React", "Node.js", "SQL", "Python", "Figma"]) expect(r.profile.skills).toContain(keep);
    expect(r.profile.jobHistory.length).toBe(3);
  });
});
