/** @jest-environment node */
import { searchJobs, ENOUGH_OWN, type JobListing, type JobQuery } from "@/lib/jobSearch";

const own = (n: number, title = "Platform Engineer"): JobListing[] =>
  Array.from({ length: n }, (_, i) => ({ key: `greenhouse:x:${i}`, source: "greenhouse" as const, title: `${title} ${i}`, company: `Co ${i}`, location: "Remote", remote: true, url: `https://x.test/${i}`, postedAt: "2026-10-01", tags: [], snippet: "", description: "d" }));

const q = (over: Partial<JobQuery> = {}): JobQuery => ({ q: "platform engineer", location: "", remoteOnly: false, country: "us", ...over });

describe("our own index answers first", () => {
  let calls: string[];
  beforeEach(() => {
    calls = [];
    jest.spyOn(global, "fetch").mockImplementation(async (u) => {
      calls.push(String(u));
      return new Response(JSON.stringify({ jobs: [], data: [], results: [] }), { status: 200 });
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it("does not ask the other boards when the index already holds plenty for what was typed", async () => {
    const r = await searchJobs(q({ q: "platform engineer one" }), [["Company career pages", async () => own(ENOUGH_OWN + 5, "Platform Engineer one")]]);
    expect(calls).toHaveLength(0);
    expect(r.sources).toEqual(["Company career pages"]);
    expect(r.jobs.length).toBeGreaterThan(0);
  });

  it("asks the other boards when the index has few", async () => {
    await searchJobs(q({ q: "platform engineer two" }), [["Company career pages", async () => own(3, "Platform Engineer two")]]);
    expect(calls.some((u) => u.includes("remotive"))).toBe(true);
  });

  it("asks the other boards when a place was typed, because local jobs come from them", async () => {
    await searchJobs(q({ q: "platform engineer three", location: "Hillside, New Jersey" }), [["Company career pages", async () => own(ENOUGH_OWN + 5, "Platform Engineer three")]]);
    expect(calls.some((u) => u.includes("remotive"))).toBe(true);
  });

  it("keeps working when the index fails", async () => {
    const r = await searchJobs(q({ q: "platform engineer four" }), [["Company career pages", async () => { throw new Error("down"); }]]);
    expect(r.sources).not.toContain("Company career pages");
    expect(calls.some((u) => u.includes("remotive"))).toBe(true);
  });
});
