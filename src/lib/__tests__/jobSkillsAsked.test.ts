/** @jest-environment node */
import { askedSkills, mentionedSkills, skillGap } from "@/lib/jobSkills";
import { fitOf } from "@/lib/jobFit";
import type { JobListing } from "@/lib/jobSearch";

const POSTING = "We value Communication, Collaboration and Leadership. You will build services in Python and Kubernetes on AWS, with strong Teamwork.";

describe("the skills a posting asks for", () => {
  it("leaves out the soft skills every posting repeats, and keeps the tools", () => {
    expect(mentionedSkills(POSTING)).toEqual(expect.arrayContaining(["Communication", "Leadership", "Python", "Kubernetes", "AWS"]));
    const asked = askedSkills(POSTING);
    expect(asked).toEqual(expect.arrayContaining(["Python", "Kubernetes", "AWS"]));
    expect(asked).not.toContain("Communication");
    expect(asked).not.toContain("Leadership");
    expect(asked).not.toContain("Teamwork");
    expect(asked).not.toContain("Collaboration");
  });

  it("a person who lists the tools has them all covered: the soft skills of the posting do not count against them", () => {
    const gap = skillGap(POSTING, ["Python", "Kubernetes", "AWS"]);
    expect(gap.missing).toEqual([]);
    expect(gap.matched).toEqual(expect.arrayContaining(["Python", "Kubernetes", "AWS"]));
  });

  it("the first estimate of a fit does not count them either", () => {
    const job = { key: "k", source: "link", title: "Software Engineer", company: "C", location: "NY", remote: false, url: "", postedAt: "", tags: [], snippet: "", description: POSTING } as JobListing;
    const a = fitOf(job, ["Python", "Kubernetes", "AWS"], "Software Engineer", 5);
    const b = fitOf({ ...job, description: "You will build services in Python and Kubernetes on AWS." }, ["Python", "Kubernetes", "AWS"], "Software Engineer", 5);
    expect(a.pct).toBe(b.pct);
  });
});
