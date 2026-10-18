import { levelOf, withoutPlus } from "@/lib/jobLevel";
import { mentionedSkills } from "@/lib/jobSkills";
import { jobScore } from "@/lib/jobScore";
import type { JobListing } from "@/lib/jobSearch";

// a real posting (as the job page shows it: summary and sections)
const GOOGLE = `Google is seeking a Staff Software Developer for the Client Stack, Front End and Web Development team within Google Cloud in New York or Waterloo. The role involves driving the technical outlook, strategy, and execution for the Chat Client Side Encryption (CSE) initiative, providing technical leadership.

## What you will do
- Provide technical leadership on high-impact projects.
- Drive the technical outlook, strategy, and execution for the Chat Client Side Encryption (CSE) initiative.

## What they ask for
- Bachelor's degree or equivalent practical experience
- 8 years of experience in software development
- 5 years of experience testing, and launching software products
- 3 years of experience with software design and architecture
- 5 years of experience with full stack development, across back-end such as Java, and front-end experience including JavaScript or TypeScript, HTML, CSS or equivalent
- 1 year of experience with mobile stack
- English proficiency

## A plus
- Master's degree or PhD in Engineering, Computer Science, or a related technical field
- 10 years of experience with data structures and algorithms
- 3 years of experience working in a complex, matrixed organization involving cross-functional, or cross-business projects

## What they offer
- US: $207000 - $300000 (USD) salary
- Canada: $216000 - $221000 (CAD) salary
- 20% bonus target

## About the company
Google's software engineers develop next-generation technologies that change how billions of users connect.`;

const job = (title: string, description: string): JobListing => ({ key: "k", source: "link", title, company: "Google", location: "New York", remote: false, url: "", postedAt: "", tags: ["Full-time"], snippet: "", description });

describe("reading a posting", () => {
  it("asks for the most years the requirements name, not the smallest sub-requirement", () => {
    expect(levelOf(job("Staff Software Developer", GOOGLE)).years).toBe(8);
  });

  it("does not count what is only a plus", () => {
    expect(withoutPlus(GOOGLE)).not.toContain("10 years of experience with data structures");
    expect(withoutPlus(GOOGLE)).toContain("5 years of experience with full stack");
    expect(withoutPlus(GOOGLE)).toContain("## What they offer"); // what comes after the plus is kept
    expect(levelOf(job("Software Developer", "2 years of experience in software.\n\nPreferred qualifications:\n- 9 years of experience with Java\n\nAbout the job\nBuild things.")).years).toBe(2);
  });

  it("does not take plain words or a currency for skills", () => {
    const skills = mentionedSkills(GOOGLE);
    expect(skills).not.toContain("Organization");
    expect(skills).not.toContain("Initiative");
    expect(skills).not.toContain("CAD"); // "(CAD)" is the Canadian dollar
    for (const s of ["Leadership", "JavaScript", "TypeScript", "Java", "HTML", "CSS", "Google Cloud"]) expect(skills).toContain(s);
    expect(mentionedSkills("We use Go and Swift. Let's go and be swift.")).toEqual(["Go", "Swift"]);
    expect(mentionedSkills("Experience with CAD software such as SolidWorks")).toContain("CAD");
  });

  it("a Staff job is far from ready for someone with two years of experience", () => {
    const me = {
      jobTitle: "Software Developer",
      skills: ["JavaScript", "TypeScript", "Java", "CSS", "React", "Python"],
      careerObjective: "Developer.",
      jobHistory: [{ id: "1", title: "Software Developer", company: "X", description: "Built web apps in JavaScript and Java.", accomplishments: [], startDate: "2024-01", endDate: "", current: true }],
      education: [{ id: "e", school: "NJIT", degree: "BS Computer Science" }],
    } as never;
    expect(jobScore(me, job("Staff Software Developer", GOOGLE), [], "classic", [], 80).score).toBeLessThan(45);
    // the same person for a job that asks for what they have keeps a high number
    expect(jobScore(me, job("Software Developer", "1 year of experience with JavaScript, Java and CSS. Build web apps."), [], "classic", [], 80).score).toBeGreaterThan(70);
  });
});
