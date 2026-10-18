import { cleanFacts } from "@/lib/jobFacts";
import { levelOf } from "@/lib/jobLevel";
import { jobScore } from "@/lib/jobScore";
import { cleanListing, type JobListing } from "@/lib/jobSearch";

// what the AI read out of the Google posting (see the real answer in the notes of the job reading)
const GOOGLE_FACTS = cleanFacts({ yearsRequired: 8, seniority: "staff", skillsRequired: ["Java", "JavaScript", "TypeScript", "HTML", "CSS"], skillsPreferred: ["Data structures", "Algorithms"] });

const job = (title: string, description: string, facts = GOOGLE_FACTS): JobListing => ({ key: "k", source: "link", title, company: "Google", location: "NY", remote: false, url: "", postedAt: "", tags: [], snippet: "", description, facts });

const me = {
  jobTitle: "Software Developer",
  skills: ["JavaScript", "TypeScript", "Java", "CSS", "React", "Python"],
  careerObjective: "Developer.",
  jobHistory: [{ id: "1", title: "Software Developer", company: "X", description: "Built web apps in JavaScript and Java.", accomplishments: [], startDate: "2024-01", endDate: "", current: true }],
  education: [{ id: "e", school: "NJIT", degree: "BS Computer Science" }],
} as never;

describe("what the AI read from a posting", () => {
  it("keeps only usable facts", () => {
    expect(GOOGLE_FACTS).toEqual({ years: 8, seniority: "staff", required: ["Java", "JavaScript", "TypeScript", "HTML", "CSS"], preferred: ["Data structures", "Algorithms"] });
    expect(cleanFacts({ yearsRequired: 0, seniority: "nonsense", skillsRequired: [] })).toBeUndefined(); // nothing said: the rules read the text
    expect(cleanFacts({ yearsRequired: 99, seniority: "senior", skillsRequired: ["a", "Java", "java"] })).toEqual({ years: null, seniority: "senior", required: ["Java"], preferred: [] });
    expect(cleanFacts("x")).toBeUndefined();
  });

  it("travels with the job (saved jobs, applications) and bad data is dropped", () => {
    const kept = cleanListing({ ...job("Staff Software Developer", "text"), url: "" });
    expect(kept?.facts?.years).toBe(8);
    expect(cleanListing({ ...job("T", "d"), url: "", facts: { years: "many" } as never })?.facts).toBeUndefined();
  });

  it("sets the level and the years, whatever the title or the wording says", () => {
    expect(levelOf(job("Software Developer", "Some text without any years."))).toEqual({ label: "Principal", years: 8 });
    expect(levelOf(job("Staff Software Developer", "x", cleanFacts({ seniority: "senior", skillsRequired: ["Java"] })))).toEqual({ label: "Senior", years: 5 }); // no years stated: the usual ones
    expect(levelOf(job("Software Engineer", "x", cleanFacts({ yearsRequired: 4, seniority: "entry", skillsRequired: ["Java"] })))).toEqual({ label: "Entry level", years: 2 });
  });

  it("scores with the skills the AI read: required ones count fully, a plus counts less", () => {
    const withAll = jobScore(me, job("Software Developer", "x", cleanFacts({ yearsRequired: 1, seniority: "mid", skillsRequired: ["Java", "JavaScript", "CSS"] })), [], "classic", [], 80);
    const missingRequired = jobScore(me, job("Software Developer", "x", cleanFacts({ yearsRequired: 1, seniority: "mid", skillsRequired: ["Java", "Rust", "Kubernetes"] })), [], "classic", [], 80);
    const missingPlus = jobScore(me, job("Software Developer", "x", cleanFacts({ yearsRequired: 1, seniority: "mid", skillsRequired: ["Java", "JavaScript", "CSS"], skillsPreferred: ["Rust"] })), [], "classic", [], 80);
    expect(withAll.skills).toEqual({ have: 3, total: 3 });
    expect(missingRequired.score).toBeLessThan(withAll.score - 10);
    expect(missingPlus.score).toBeGreaterThan(missingRequired.score);
    expect(missingPlus.score).toBeLessThanOrEqual(withAll.score);
  });

  it("the Staff posting is far from ready for two years of experience", () => {
    expect(jobScore(me, job("Staff Software Developer", "x"), [], "classic", [], 80).score).toBeLessThan(40);
  });
});
