/** @jest-environment node */
// The background reading of the jobs nobody has read yet (ingest/enrich).
type Doc = Record<string, unknown>;
const DESC = "Build services in Python. ".repeat(30);
const jobs: Doc[] = [];
const readKeys = new Set<string>();

jest.mock("@/lib/ingest/run", () => ({
  index: () => ({
    find: (filter: { $or?: unknown[] }) => {
      const pool = jobs.filter((j) => !filter.$or || j.country === "US" || j.remote === true);
      const cursor = {
        sort: () => cursor,
        skip: (n: number) => ((cursor.start = n), cursor),
        limit: (n: number) => ((cursor.n = n), cursor),
        project: () => cursor,
        start: 0,
        n: 100,
        toArray: async () => [...pool].sort((a, b) => String(b.postedAt).localeCompare(String(a.postedAt))).slice(cursor.start, cursor.start + cursor.n),
      };
      return cursor;
    },
  }),
}));
jest.mock("@/lib/mongodb", () => ({
  db: { collection: () => ({ find: (f: { key: { $in: string[] } }) => ({ project: () => ({ toArray: async () => f.key.$in.filter((k) => readKeys.has(k)).map((key) => ({ key })) }) }) }) },
}));
const mockTake = jest.fn();
const mockRead = jest.fn();
jest.mock("@/lib/jobFactsStore", () => ({ MIN_TEXT: 300, takeReading: () => mockTake(), readOnce: (j: { key: string }) => mockRead(j) }));

import { enrichBatch, pickUnread } from "@/lib/ingest/enrich";

const job = (key: string, postedAt: string, over: Doc = {}): Doc => ({ key, title: "Engineer", company: "C", location: "NY", remote: false, url: "https://x.test", postedAt, tags: [], snippet: "", description: DESC, source: "greenhouse", country: "US", ...over });

beforeEach(() => {
  jobs.length = 0;
  readKeys.clear();
  mockTake.mockReset().mockResolvedValue(true);
  mockRead.mockReset().mockResolvedValue(null);
});

describe("choosing what to read", () => {
  it("takes the most recent unread jobs first, skips the ones already read and the ones without a text worth reading", async () => {
    jobs.push(job("a", "2026-10-01"), job("b", "2026-10-17"), job("c", "2026-10-10"), job("d", "2026-10-16", { description: "short" }), job("e", "2026-10-18"));
    readKeys.add("e");
    expect((await pickUnread(10)).map((j) => j.key)).toEqual(["b", "c", "a"]);
  });

  it("puts the jobs a person in the US sees before the others, even when the others are newer", async () => {
    jobs.push(job("us-old", "2026-09-01"), job("de-new", "2026-10-18", { country: "DE" }), job("remote", "2026-09-15", { country: undefined, remote: true }));
    expect((await pickUnread(10)).map((j) => j.key)).toEqual(["remote", "us-old", "de-new"]);
  });

  it("does not return more than asked, and never the same job twice", async () => {
    for (let i = 0; i < 12; i++) jobs.push(job(`j${i}`, `2026-10-${String(10 + i).padStart(2, "0")}`));
    const got = await pickUnread(5);
    expect(got).toHaveLength(5);
    expect(new Set(got.map((j) => j.key)).size).toBe(5);
  });
});

describe("reading a batch", () => {
  it("reads what there is, and says when nothing is left", async () => {
    jobs.push(job("a", "2026-10-01"), job("b", "2026-10-02"));
    const r = await enrichBatch({ ms: 5000, parallel: 2 });
    expect(r).toEqual({ read: 2, failed: 0 });
    expect(mockRead).toHaveBeenCalledTimes(2);
    jobs.length = 0;
    expect(await enrichBatch({ ms: 5000 })).toEqual({ read: 0, failed: 0, stopped: "done" });
  });

  it("stops when the day's budget is used up", async () => {
    for (let i = 0; i < 6; i++) jobs.push(job(`j${i}`, `2026-10-0${i + 1}`));
    mockTake.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false);
    const r = await enrichBatch({ ms: 5000, parallel: 1 });
    expect(r).toMatchObject({ read: 2, stopped: "budget" });
  });

  it("stops when the AI says it is busy, and counts a job that failed for another reason without stopping", async () => {
    for (let i = 0; i < 4; i++) jobs.push(job(`j${i}`, `2026-10-0${i + 1}`));
    mockRead.mockRejectedValueOnce(new Error("bad answer")).mockResolvedValueOnce(null).mockRejectedValue(Object.assign(new Error("busy"), { status: 429 }));
    const r = await enrichBatch({ ms: 5000, parallel: 1 });
    expect(r).toMatchObject({ read: 1, failed: 1, stopped: "busy" });
  });

  it("stops when its time is up", async () => {
    for (let i = 0; i < 4; i++) jobs.push(job(`j${i}`, `2026-10-0${i + 1}`));
    const r = await enrichBatch({ ms: -1, parallel: 1 });
    expect(r).toMatchObject({ read: 0, stopped: "time" });
  });
});
