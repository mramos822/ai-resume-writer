/** @jest-environment node */
import { jobScore } from "@/lib/jobScore";
import type { JobListing } from "@/lib/jobSearch";

const me = (years: number) =>
  ({
    jobTitle: "Full-Stack Developer",
    skills: ["TypeScript", "JavaScript", "React", "Node.js", "SQL", "Python", "Docker", "Git"],
    careerObjective: "Full-stack developer building web apps with React and Node.js.",
    jobHistory: [{ id: "1", title: "Full-Stack Developer", company: "X", description: "Built React and Node.js apps with SQL and Docker.", accomplishments: ["Shipped APIs in TypeScript"], startDate: `${2026 - years}-01`, endDate: "", current: true }],
    education: [{ id: "e", school: "NJIT", degree: "BS Computer Science" }],
    experienceLevel: years >= 5 ? "senior" : years >= 2 ? "mid" : "entry",
  }) as never;

const job = (over: Partial<JobListing>): JobListing => ({ key: "k", source: "greenhouse", title: "Full Stack Developer", company: "C", location: "NY", remote: false, url: "https://x.test", postedAt: "", tags: [], snippet: "", description: "", ...over });
const score = (j: JobListing, years = 4) => jobScore(me(years), j, [], "classic", [], 90).score;

describe("the fit tells a good match from a bad one", () => {
  const GOOD = job({ description: "Build web apps with React, Node.js, TypeScript and SQL. 3+ years of experience." });

  it("a job in the person's field that asks for their skills is high, one that is not their field is near zero", () => {
    expect(score(GOOD)).toBeGreaterThan(80);
    expect(score(job({ title: "Registered Nurse", description: "Care for patients. Patient Care, Vital Signs, Charting. 2 years of experience." }))).toBeLessThan(8);
    expect(score(job({ title: "Account Executive", description: "Sell our software to enterprise customers. Salesforce, Negotiation." }))).toBeLessThan(8);
  });

  it("the same title with other skills is in the middle", () => {
    const other = job({ description: "Build mobile apps with Swift, Kotlin and Objective-C. 3+ years of experience." });
    expect(score(other)).toBeGreaterThan(25);
    expect(score(other)).toBeLessThan(score(GOOD) - 25);
  });

  it("a posting that names no skill gives no credit to a job that is not the person's field", () => {
    const vague = (title: string) => score(job({ title, description: "We are a great team looking for someone to join us and make an impact." }));
    expect(vague("Full Stack Developer")).toBeGreaterThan(vague("Marketing Manager") + 30);
    expect(vague("Marketing Manager")).toBeLessThan(5);
  });

  it("an internship or an entry level job is not a great fit for someone with years of experience", () => {
    const intern = job({ title: "Software Engineering Intern", description: "Build web apps with React, Node.js, TypeScript and SQL." });
    expect(score(intern, 1)).toBeGreaterThan(score(intern, 5) + 20);
    expect(score(job({ title: "Junior Full Stack Developer", description: GOOD.description }), 6)).toBeLessThan(score(GOOD, 6));
  });

  it("a job far above the person is much lower", () => {
    const staff = job({ title: "Staff Full Stack Developer", description: "Build web apps with React, Node.js, TypeScript and SQL. 10+ years of experience." });
    expect(score(staff, 2)).toBeLessThan(score(GOOD, 2) / 2);
  });
});
