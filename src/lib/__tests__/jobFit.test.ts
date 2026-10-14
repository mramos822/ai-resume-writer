import { fitOf } from "@/lib/jobFit";
import { levelOf } from "@/lib/jobLevel";
import type { JobListing } from "@/lib/jobSearch";

const posting = (title: string, description: string): JobListing => ({
  key: "k",
  source: "link",
  title,
  company: "Affirm",
  location: "Remote",
  remote: true,
  url: "",
  postedAt: "",
  tags: ["Full-time"],
  snippet: "A short summary of the job.",
  description,
});

const EARLY = posting(
  "Software Engineer, Early Career (Backend)",
  "Build and ship backend services in Python and Kotlin. We look for a Bachelor's degree in Computer Science, strong fundamentals in data structures and algorithms, internship or project experience. Nice to have: AWS, Docker, SQL, REST APIs and CI/CD."
);
const SKILLS = ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "Git"];

describe("fit with a job", () => {
  it("knows an early career job is entry level and asks for no experience", () => {
    expect(levelOf(EARLY)).toEqual({ label: "Entry level", years: 0 });
    expect(levelOf(posting("Software Engineer I", "5+ years of experience in the team"))).toEqual({ label: "Entry level", years: 2 });
  });

  it("does not drop a software engineer for an early career software engineer job because specific skills are missing", () => {
    const fit = fitOf(EARLY, SKILLS, "Software Engineer", 0);
    expect(fit.pct).toBeGreaterThanOrEqual(60);
    expect(fit.matched).toContain("SQL"); // the whole posting is read, not only its summary
  });

  it("reads Full Stack Developer and Software Engineer as the same kind of work", () => {
    expect(fitOf(EARLY, SKILLS, "Full Stack Developer", 0).pct).toBe(fitOf(EARLY, SKILLS, "Software Engineer", 0).pct);
  });

  it("still tells apart a different kind of work", () => {
    const nurse = fitOf(EARLY, ["Patient Care"], "Registered Nurse", 0).pct;
    const engineer = fitOf(EARLY, SKILLS, "Software Engineer", 0).pct;
    expect(nurse).toBeLessThan(engineer - 20);
  });

  it("lowers the fit for a job that asks for much more experience", () => {
    const senior = posting("Staff Software Engineer", "10+ years of experience with Python, AWS and SQL.");
    expect(fitOf(senior, SKILLS, "Software Engineer", 0).pct).toBeLessThan(fitOf(EARLY, SKILLS, "Software Engineer", 0).pct);
  });
});
