/** @jest-environment node */
import { jobScore } from "@/lib/jobScore";
import { langOfCountry, resumeLangForJob } from "@/lib/resumeLang";
import type { JobListing } from "@/lib/jobSearch";

const me = {
  jobTitle: "Full-Stack Developer",
  skills: ["TypeScript", "React", "Node.js", "SQL"],
  careerObjective: "Full-stack developer building web apps.",
  jobHistory: [{ id: "1", title: "Full-Stack Developer", company: "X", description: "Built React apps.", accomplishments: ["Shipped APIs"], startDate: "2020-01", endDate: "2024-01" }],
  education: [{ id: "e", school: "NJIT", degree: "BS Computer Science" }],
} as never;
const job: JobListing = { key: "k", source: "greenhouse", title: "Full Stack Developer", company: "C", location: "NY", remote: false, url: "https://x.test", postedAt: "2026-01-01", tags: [], snippet: "", description: "Build web apps with React, Node.js and SQL. 3+ years of experience." };

describe("the keywords a review asks for", () => {
  it("never lower the number when the resume does not say them yet", () => {
    const without = jobScore(me, job, [], "classic", [], 90).score;
    expect(jobScore(me, job, [], "classic", ["GraphQL", "Kubernetes", "Terraform"], 90).score).toBeGreaterThanOrEqual(without);
  });
});

describe("the language of the resume made for a job", () => {
  const ad = (over: Partial<JobListing>) => ({ ...job, description: "", snippet: "Contador general", ...over });
  it("goes by the country when the text is too short to tell", () => {
    expect(langOfCountry("CL")).toBe("es");
    expect(langOfCountry("gb")).toBe("en");
    expect(langOfCountry("de")).toBeNull();
    expect(resumeLangForJob(ad({ country: "pe" }), "en")).toBe("es");
    expect(resumeLangForJob(ad({ country: "ie", title: "Accountant" }), "es")).toBe("en");
  });
  it("falls back to the language of the app for a country it cannot write in", () => {
    expect(resumeLangForJob(ad({ country: "de" }), "es")).toBe("es");
  });
  it("the text of the posting wins over the country", () => {
    const text = "We are looking for an accountant to join our team. You will work with our clients and you will be responsible for the experience of the team in the role.";
    expect(resumeLangForJob(ad({ country: "mx", description: text }), "es")).toBe("en");
  });
});
