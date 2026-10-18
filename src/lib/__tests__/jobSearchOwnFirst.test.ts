/** @jest-environment node */
import { searchJobs, searchJobsWide, ENOUGH_OWN, type JobListing, type JobQuery } from "@/lib/jobSearch";

const own = (n: number, title = "Platform Engineer"): JobListing[] =>
  Array.from({ length: n }, (_, i) => ({ key: `greenhouse:${title}:${i}`, source: "greenhouse" as const, title: `${title} ${i}`, company: `Co ${title} ${i}`, location: "Remote", remote: true, url: `https://x.test/${i}`, postedAt: "2026-10-01", tags: [], snippet: "", description: "d" }));

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

  it("a wide search (several titles) does not wait for the other boards when the index answers all of them together", async () => {
    // (each test uses its own family of titles: the searches are remembered for a few minutes)
    // each title brings a few jobs, none enough alone, but together plenty
    const bytitle = async (q2: JobQuery) => own(Math.ceil(ENOUGH_OWN / 2), q2.q + " wide-a");
    const r = await searchJobsWide(q({ q: "devops engineer wide-a" }), [], [["Company career pages", bytitle]]);
    expect(calls).toHaveLength(0);
    expect(r.jobs.length).toBeGreaterThanOrEqual(ENOUGH_OWN);
  });

  it("a wide search asks the other boards when even all the titles together are few", async () => {
    await searchJobsWide(q({ q: "nurse wide-b" }), [], [["Company career pages", async (q2: JobQuery) => own(2, q2.q + " wide-b")]]);
    expect(calls.some((u) => u.includes("remotive"))).toBe(true);
  });

  it("keeps working when the index fails", async () => {
    const r = await searchJobs(q({ q: "platform engineer four" }), [["Company career pages", async () => { throw new Error("down"); }]]);
    expect(r.sources).not.toContain("Company career pages");
    expect(calls.some((u) => u.includes("remotive"))).toBe(true);
  });
});
