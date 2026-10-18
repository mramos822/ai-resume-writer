/** @jest-environment node */
import { fromArbeitnow, fromRemotive } from "@/lib/ingest/ats";
import type { Board } from "@/lib/ingest/boards";

const R: Board = { source: "remotive", token: "all", name: "Remotive" };
const A: Board = { source: "arbeitnow", token: "all", name: "Arbeitnow" };

describe("reading the feeds of Remotive and Arbeitnow", () => {
  it("turns a Remotive job into a job: remote, with its list as a list, its pay and the board's own link", () => {
    const j = fromRemotive(R, {
      id: 1234,
      url: "https://remotive.com/remote-jobs/software-dev/backend-1234",
      title: "Backend Engineer",
      company_name: "Acme",
      company_logo: "https://remotive.com/logo.png",
      category: "Software Development",
      tags: ["python", "aws"],
      job_type: "full_time",
      publication_date: "2026-10-17T08:00:00",
      candidate_required_location: "USA Only",
      salary: "$90k - $120k",
      description: "<p>Build the services.</p><ul><li>3+ years of experience with Python</li><li>AWS</li></ul>",
    })!;
    expect(j).toMatchObject({ key: "remotive:1234", source: "remotive", company: "Acme", remote: true, location: "USA Only", country: "US", salary: "$90k - $120k", board: "remotive:all" });
    expect(j.tags).toEqual(["Software Development", "full time", "python", "aws"]);
    expect(j.description).toContain("- 3+ years of experience with Python");
    expect(j.url).toBe("https://remotive.com/remote-jobs/software-dev/backend-1234");
  });

  it("turns an Arbeitnow job into a job: its place, its country and the date it was created", () => {
    const j = fromArbeitnow(A, { slug: "dev-berlin-99", title: "Developer", company_name: "Firma", description: "<p>We pay EUR 60,000 - 80,000? No: $60,000 - $80,000 a year.</p>", remote: false, url: "https://www.arbeitnow.com/jobs/dev-berlin-99", location: "Berlin", job_types: ["Full Time"], tags: ["IT"], created_at: 1791566108 })!;
    expect(j).toMatchObject({ key: "arbeitnow:dev-berlin-99", source: "arbeitnow", remote: false, location: "Berlin", country: "DE", board: "arbeitnow:all", salary: "$60,000 – $80,000" });
    expect(j.postedAt).toBe(new Date(1791566108 * 1000).toISOString());
  });

  it("leaves out a job without a link or a title", () => {
    expect(fromRemotive(R, { id: 1, title: "x", url: "javascript:void(0)" })).toBeNull();
    expect(fromArbeitnow(A, { slug: "s", title: "", url: "https://x.test" })).toBeNull();
  });
});
