jest.mock("@/lib/openaiClient", () => ({ getOpenAIChatCompletion: jest.fn() }));
jest.mock("@/lib/aiConfig", () => ({ AI_MODEL: "test" }));

import { cutSuggestions } from "@/lib/applicationCoach";
import type { JobListing } from "@/lib/jobSearch";
import type { ProfileData } from "@/context/profileContext";

const job = (title: string, text = ""): JobListing => ({ key: "k", source: "link", title, company: "Acme", location: "", remote: true, url: "", postedAt: "", tags: [], snippet: text, description: text });
const profile = (jobTitle: string, skills: string[]) => ({ name: "A", jobTitle, careerObjective: "", skills, jobHistory: [], education: [], internships: [], projects: [], contactInfo: { email: "", phone: "", address: "" } }) as unknown as ProfileData;

// more skills of the same career, so the lists are long enough for anything to be taken out (a resume is never cut below twenty)
const filler = ["Go", "Rust", "C++", "Azure", "GraphQL", "MySQL", "PostgreSQL", "Firebase", "Angular", "Vue"];

describe("what Trim it for me may take out of the skills", () => {
  const software = ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "Docker", "AWS", "Git", "Jira", "Communication", "Teamwork", "Microsoft Excel", ...filler];

  it("never proposes the general knowledge of the career, soft skills or office tools", () => {
    const cut = cutSuggestions(profile("Software Engineer", software), job("Software Engineer", "We use Python and Kotlin."));
    expect(cut.skills).toEqual([]);
  });

  it("proposes a skill that belongs to a career far from the job and from the person", () => {
    const cut = cutSuggestions(profile("Software Engineer", [...software, "Patient Care", "Phlebotomy"]), job("Software Engineer", "We use Python."));
    expect(cut.skills.sort()).toEqual(["Patient Care", "Phlebotomy"].sort());
  });

  it("proposes exact repeats, but not a more specific skill built on another one", () => {
    const cut = cutSuggestions(profile("Software Engineer", [...software, "GitHub", "GitHub Actions", "git"]), job("Software Engineer", ""));
    expect(cut.skills).toContain("git");
    expect(cut.skills).not.toContain("GitHub Actions");
  });

  it("does not call anything far when the field is not known, and keeps what the person confirmed", () => {
    const unknown = cutSuggestions(profile("", [...software, "Patient Care"]), job("Thing", ""));
    expect(unknown.skills).toEqual([]);
    const confirmed = cutSuggestions(profile("Software Engineer", [...software, "Patient Care"]), job("Software Engineer", ""), ["Patient Care"]);
    expect(confirmed.skills).toEqual([]);
  });

  it("never goes below twenty skills or takes more than a quarter", () => {
    const few = cutSuggestions(profile("Software Engineer", ["Python", "Java", "Patient Care", "Phlebotomy", "Nursing", "Triage"]), job("Software Engineer", ""));
    expect(few.skills).toEqual([]);
  });
});

describe("skills worth a second look when the list is long", () => {
  const software = ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "Docker", "AWS", "Git", "Jira", "Python", "Java", "MongoDB", "Redis", "Linux", "Kubernetes", "Go", "Rust", "C++", "Azure", "GraphQL"];

  it("says nothing for a list of twenty or fewer", () => {
    expect(cutSuggestions(profile("Software Engineer", software), job("Software Engineer", "")).review).toEqual([]);
  });

  it("ranks first what repeats another, then the generic ones, and never removes by itself", () => {
    const skills = [...software, "GitHub", "GitHub Actions", "Teamwork", "Microsoft Office", "Trello"];
    const cut = cutSuggestions(profile("Software Engineer", skills), job("Software Engineer", "We use React and SQL."));
    expect(cut.review.length).toBeGreaterThan(0);
    expect(cut.review[0]).toEqual({ skill: "GitHub Actions", why: "repeats", of: "GitHub" });
    expect(cut.review.map((r) => r.skill)).not.toContain("React"); // the job asks for it
    expect(cut.skills).toEqual([]); // the review list is not part of what is removed automatically
  });

  it("never leaves the list below twenty and never offers a language", () => {
    const skills = [...software, "Spanish", "GitHub", "GitHub Actions"];
    const cut = cutSuggestions(profile("Software Engineer", skills), job("Software Engineer", ""));
    expect(cut.review.map((r) => r.skill)).not.toContain("Spanish");
    expect(skills.length - cut.review.length).toBeGreaterThanOrEqual(20);
  });
});
