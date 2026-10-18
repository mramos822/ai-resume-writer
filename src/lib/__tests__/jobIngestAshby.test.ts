/** @jest-environment node */
import { fromAshby } from "@/lib/ingest/ats";
import type { Board } from "@/lib/ingest/boards";

const B: Board = { source: "ashby", token: "openai", name: "OpenAI" };
const job = (over: Record<string, unknown> = {}) => ({
  id: "3b5d54ca-741b",
  title: "Software Engineer, Platform",
  department: "Engineering",
  team: "Platform",
  employmentType: "FullTime",
  location: "San Francisco",
  isListed: true,
  isRemote: false,
  workplaceType: "Hybrid",
  publishedAt: "2026-10-01T12:00:00.000+00:00",
  jobUrl: "https://jobs.ashbyhq.com/openai/3b5d54ca-741b",
  descriptionHtml: "<p>Build the platform.</p><h3>You have</h3><ul><li>5+ years of experience with Python</li><li>Kubernetes</li></ul>",
  compensation: { scrapeableCompensationSalarySummary: "$200K – $300K" },
  ...over,
});

describe("reading an Ashby posting", () => {
  it("turns it into a job: the list stays a list, the pay and the place come along", () => {
    const j = fromAshby(B, job())!;
    expect(j).toMatchObject({ key: "ashby:openai:3b5d54ca-741b", source: "ashby", company: "OpenAI", title: "Software Engineer, Platform", location: "San Francisco", remote: false, salary: "$200K – $300K", board: "ashby:openai", tags: ["Platform", "FullTime"] });
    expect(j.postedAt).toBe("2026-10-01T12:00:00.000Z");
    expect(j.description).toContain("- 5+ years of experience with Python");
    expect(j.description).not.toContain("<");
  });

  it("knows a remote job from the workplace type", () => {
    expect(fromAshby(B, job({ workplaceType: "Remote", isRemote: null }))!.remote).toBe(true);
  });

  it("leaves out a job that is not listed or has no link", () => {
    expect(fromAshby(B, job({ isListed: false }))).toBeNull();
    expect(fromAshby(B, job({ jobUrl: "ftp://x" }))).toBeNull();
  });

  it("uses the plain text when there is no html", () => {
    expect(fromAshby(B, job({ descriptionHtml: undefined, descriptionPlain: "Plain text of the job." }))!.description).toBe("Plain text of the job.");
  });
});
