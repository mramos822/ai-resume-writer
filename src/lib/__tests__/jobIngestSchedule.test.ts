/** @jest-environment node */
// the log of runs, in memory
type Doc = Record<string, unknown>;
const runs: Doc[] = [];
const cmp = (v: unknown, c: Record<string, unknown>) =>
  Object.entries(c).every(([op, x]) => (op === "$lt" ? +(v as Date) < +(x as Date) : op === "$gt" ? +(v as Date) > +(x as Date) : op === "$exists" ? (v !== undefined) === x : true));
const match = (d: Doc, f: Doc) => Object.entries(f).every(([k, v]) => (v && typeof v === "object" && !(v instanceof Date) ? cmp(d[k], v as Record<string, unknown>) : +(d[k] as Date) === +(v as Date) || d[k] === v));
jest.mock("@/lib/mongodb", () => ({
  db: {
    collection: () => ({
      find: (f: Doc) => ({ sort: () => ({ limit: (n: number) => ({ toArray: async () => runs.filter((d) => match(d, f)).sort((a, b) => +(b.startedAt as Date) - +(a.startedAt as Date)).slice(0, n) }) }) }),
      findOne: async (f: Doc) => runs.find((d) => match(d, f)) ?? null,
      insertOne: async (d: Doc) => void runs.push({ ...d }),
      deleteOne: async (f: Doc) => void runs.splice(runs.findIndex((d) => match(d, f)), 1),
      updateOne: async (f: Doc, u: { $set: Doc }) => void Object.assign(runs.find((d) => match(d, f)) as Doc, u.$set),
    }),
  },
}));
const mockIngest = jest.fn();
jest.mock("@/lib/ingest/run", () => ({ runIngestion: (...a: unknown[]) => mockIngest(...a) }));

import { ingestNow, EVERY_MS, STUCK_MS } from "@/lib/ingest/schedule";
import type { Board } from "@/lib/ingest/boards";

const boards: Board[] = [{ source: "greenhouse", token: "stripe" }];
const ok = { results: [{ board: "greenhouse:stripe", jobs: 10, closed: 1 }, { board: "lever:x", jobs: 0, closed: 0, error: "lever x: 404" }], jobs: 10, closed: 1, failed: 1, ms: 4000 };
const T0 = new Date("2026-10-18T06:00:00Z");
const after = (ms: number) => new Date(+T0 + ms);

beforeEach(() => {
  runs.length = 0;
  mockIngest.mockReset().mockResolvedValue(ok);
});

describe("when the ingestion runs", () => {
  it("runs and writes its log: what it read, closed and what failed", async () => {
    const r = await ingestNow({ by: "scheduler", onlyIfDue: false, boards, now: T0 });
    expect(r).toMatchObject({ started: true, run: { boards: 1, jobs: 10, closed: 1, failed: 1, seconds: 4, errors: ["lever:x: lever x: 404"] } });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ by: "scheduler", jobs: 10, failed: 1 });
    expect(runs[0].finishedAt).toBeInstanceOf(Date);
  });

  it("the search starts it only when the last reading is old", async () => {
    await ingestNow({ by: "scheduler", onlyIfDue: false, boards, now: T0 });
    expect(await ingestNow({ by: "search", onlyIfDue: true, boards, now: after(60_000) })).toEqual({ started: false, reason: "fresh" });
    expect(mockIngest).toHaveBeenCalledTimes(1);
    const late = await ingestNow({ by: "search", onlyIfDue: true, boards, now: after(EVERY_MS + 120_000) });
    expect(late.started).toBe(true);
    expect(mockIngest).toHaveBeenCalledTimes(2);
  });

  it("the scheduler runs even when the last reading is recent", async () => {
    await ingestNow({ by: "scheduler", onlyIfDue: false, boards, now: T0 });
    expect((await ingestNow({ by: "scheduler", onlyIfDue: false, boards, now: after(60_000) })).started).toBe(true);
  });

  it("does not start a second run while one is going, but does not wait for one that got stuck", async () => {
    runs.push({ startedAt: T0, by: "search", boards: 1 }); // started, never finished
    expect(await ingestNow({ by: "scheduler", onlyIfDue: false, boards, now: after(60_000) })).toEqual({ started: false, reason: "running" });
    expect(mockIngest).not.toHaveBeenCalled();
    const stuck = await ingestNow({ by: "scheduler", onlyIfDue: false, boards, now: after(STUCK_MS + 60_000) });
    expect(stuck.started).toBe(true);
  });

  it("never throws: a failing database just means it does not run", async () => {
    mockIngest.mockRejectedValue(new Error("boom"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect(await ingestNow({ by: "scheduler", onlyIfDue: false, boards, now: T0 })).toEqual({ started: false, reason: "error" });
  });
});
