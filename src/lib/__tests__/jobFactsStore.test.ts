/** @jest-environment node */
import type { JobListing } from "@/lib/jobSearch";

type Doc = Record<string, unknown>;
const stores: Record<string, Doc[]> = { job_reads: [], ai_budget: [] };
const matches = (d: Doc, f: Doc) =>
  Object.entries(f).every(([k, v]) => {
    if (v && typeof v === "object" && "$in" in (v as object)) return (v as { $in: unknown[] }).$in.includes(d[k]);
    if (v && typeof v === "object" && "$lt" in (v as object)) return (d[k] as number) < (v as { $lt: number }).$lt;
    return d[k] === v;
  });
jest.mock("@/lib/mongodb", () => ({
  db: {
    collection: (name: string) => {
      const rows = stores[name];
      return {
        find: (f: Doc) => ({ project: () => ({ toArray: async () => rows.filter((d) => matches(d, f)) }), toArray: async () => rows.filter((d) => matches(d, f)) }),
        updateOne: async (f: Doc, u: { $set?: Doc; $inc?: Doc; $setOnInsert?: Doc }, o?: { upsert?: boolean }) => {
          const hit = rows.find((d) => matches(d, f));
          if (hit) {
            Object.assign(hit, u.$set ?? {});
            for (const [k, v] of Object.entries(u.$inc ?? {})) hit[k] = (Number(hit[k]) || 0) + Number(v);
          } else if (name === "ai_budget" && rows.some((d) => d._id === f._id)) {
            throw new Error("E11000 duplicate key"); // the day is full: the filter matched nothing and the same _id cannot be inserted again
          } else if (o?.upsert) {
            rows.push({ _id: f._id, ...(u.$set ?? {}), ...(u.$setOnInsert ?? {}), ...Object.fromEntries(Object.entries(u.$inc ?? {}).map(([k, v]) => [k, Number(v)])), ...(f.key ? { key: f.key } : {}) });
          }
        },
      };
    },
  },
}));

// the real reading of the text needs a key for the AI: it is replaced here, only the facts it returns matter
jest.mock("@/lib/openaiClient", () => ({ getOpenAIChatCompletion: jest.fn() }));
jest.mock("@/lib/aiConfig", () => ({ AI_MODEL: "test" }));
const mockRead = jest.fn();
jest.mock("@/lib/jobDigest", () => {
  const actual = jest.requireActual("@/lib/jobDigest");
  return { ...actual, readPosting: (...a: unknown[]) => mockRead(...a) };
});

import { readsPerDay, storedFacts, takeReading, warm, withStoredFacts } from "@/lib/jobFactsStore";

const job = (id: string, over: Partial<JobListing> = {}): JobListing => ({ key: `ashby:x:${id}`, source: "ashby", title: "Backend Engineer", company: "Co", location: "NY", remote: false, url: "https://x.test/" + id, postedAt: "", tags: [], snippet: "", description: "Build services. ".repeat(40), ...over });
const RAW = { title: "Backend Engineer", summary: "A backend role that builds the services of the company with a platform team.", requirements: ["5 years of experience with Python"], yearsRequired: 5, seniority: "senior", skillsRequired: ["Python", "Kubernetes"], skillsPreferred: ["Go"] };

beforeEach(() => {
  stores.job_reads.length = 0;
  stores.ai_budget.length = 0;
  mockRead.mockReset().mockResolvedValue(RAW);
  delete process.env.JOB_FACTS_PER_DAY;
});

describe("the daily budget of AI readings", () => {
  it("defaults to a small number and can be changed", () => {
    expect(readsPerDay()).toBe(150);
    process.env.JOB_FACTS_PER_DAY = "3";
    expect(readsPerDay()).toBe(3);
    process.env.JOB_FACTS_PER_DAY = "0";
    expect(readsPerDay()).toBe(0);
  });

  it("gives out exactly as many readings as the limit says, then says no", async () => {
    process.env.JOB_FACTS_PER_DAY = "2";
    const now = new Date("2026-10-18T12:00:00Z");
    expect([await takeReading(now), await takeReading(now), await takeReading(now)]).toEqual([true, true, false]);
    expect(await takeReading(new Date("2026-10-19T00:30:00Z"))).toBe(true); // a new day, a new budget
  });
});

describe("reading the jobs on screen in the background", () => {
  it("reads the ones that were not read, keeps what the AI found, and does not read them again", async () => {
    const r = await warm([job("1"), job("2")], 0);
    expect(r).toEqual({ read: 2 });
    expect(mockRead).toHaveBeenCalledTimes(2);
    expect((await storedFacts([job("1").key]))[job("1").key]).toEqual({ years: 5, seniority: "senior", required: ["Python", "Kubernetes"], preferred: ["Go"] });
    await warm([job("1"), job("2")], 0);
    expect(mockRead).toHaveBeenCalledTimes(2);
  });

  it("puts the facts that were read into the jobs", async () => {
    await warm([job("1")], 0);
    const out = await withStoredFacts([job("1"), job("2")]);
    expect(out[0].facts?.years).toBe(5);
    expect(out[1].facts).toBeUndefined();
  });

  it("does not read a job without a text worth reading", async () => {
    expect(await warm([job("3", { description: "short" })], 0)).toEqual({ read: 0 });
    expect(mockRead).not.toHaveBeenCalled();
  });

  it("stops when the day's budget is used up", async () => {
    process.env.JOB_FACTS_PER_DAY = "1";
    expect(await warm([job("1"), job("2"), job("3")], 0)).toEqual({ read: 1, stopped: "budget" });
  });

  it("stops when the AI says it is busy, and keeps what was already read", async () => {
    mockRead.mockResolvedValueOnce(RAW).mockRejectedValueOnce(Object.assign(new Error("busy"), { status: 429 }));
    expect(await warm([job("1"), job("2"), job("3")], 0)).toEqual({ read: 1, stopped: "busy" });
    expect(Object.keys(await storedFacts([job("1").key, job("2").key, job("3").key]))).toEqual([job("1").key]);
  });

  it("one that fails for another reason does not stop the rest", async () => {
    mockRead.mockRejectedValueOnce(new Error("bad answer")).mockResolvedValue(RAW);
    expect(await warm([job("1"), job("2")], 0)).toEqual({ read: 1 });
  });
});
