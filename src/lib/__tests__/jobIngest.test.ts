/** @jest-environment node */
import type { Board } from "@/lib/ingest/boards";

// an in-memory stand-in for the jobs_index collection
type Doc = Record<string, unknown>;
const rows: Doc[] = [];
const match = (d: Doc, f: Doc): boolean =>
  Object.entries(f).every(([k, v]) => (v && typeof v === "object" && "$lt" in (v as object) ? (d[k] as Date) < (v as { $lt: Date }).$lt : d[k] === v));
jest.mock("@/lib/mongodb", () => ({
  db: {
    collection: () => ({
      bulkWrite: async (ops: { updateOne: { filter: Doc; update: { $set: Doc; $setOnInsert: Doc; $unset: Doc }; upsert: boolean } }[]) => {
        for (const { updateOne: o } of ops) {
          const hit = rows.find((d) => match(d, o.filter));
          if (hit) {
            Object.assign(hit, o.update.$set);
            for (const k of Object.keys(o.update.$unset)) delete hit[k];
          } else rows.push({ ...o.update.$set, ...o.update.$setOnInsert });
        }
      },
      updateMany: async (f: Doc, u: { $set: Doc }) => {
        const hit = rows.filter((d) => match(d, f));
        hit.forEach((d) => Object.assign(d, u.$set));
        return { modifiedCount: hit.length };
      },
    }),
  },
}));

import { fromGreenhouse, fromLever } from "@/lib/ingest/ats";
import { ingestBoard, CLOSED_KEPT_MS } from "@/lib/ingest/run";

const GH: Board = { source: "greenhouse", token: "stripe", name: "Stripe" };
const LV: Board = { source: "lever", token: "spotify", name: "Spotify" };

const ghJob = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  title: "Backend Engineer",
  location: { name: "Remote - US" },
  absolute_url: `https://boards.greenhouse.io/stripe/jobs/${id}`,
  first_published: "2026-09-03T13:32:53-04:00",
  content: "&lt;h2&gt;About us&lt;/h2&gt;&lt;p&gt;We build things.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;5+ years of experience with Java&lt;/li&gt;&lt;li&gt;Kubernetes&lt;/li&gt;&lt;/ul&gt;",
  departments: [{ name: "8611 Security Analytics" }],
  ...over,
});

describe("reading the company boards", () => {
  it("turns a Greenhouse posting into a job, with its text clean and its list kept as a list", () => {
    const j = fromGreenhouse(GH, ghJob(7))!;
    expect(j).toMatchObject({ key: "greenhouse:stripe:7", source: "greenhouse", title: "Backend Engineer", company: "Stripe", location: "Remote - US", remote: true, board: "greenhouse:stripe", tags: ["Security Analytics"] });
    expect(j.postedAt).toBe("2026-09-03T17:32:53.000Z");
    expect(j.description).toContain("About us");
    expect(j.description).toContain("- 5+ years of experience with Java");
    expect(j.description).not.toContain("&lt;");
    expect(j.description).not.toContain("<");
  });

  it("drops a posting that has no link to apply or no title", () => {
    expect(fromGreenhouse(GH, ghJob(8, { absolute_url: "javascript:alert(1)" }))).toBeNull();
    expect(fromGreenhouse(GH, ghJob(9, { title: "" }))).toBeNull();
  });

  it("turns a Lever posting into a job: its lists under their headings, remote and pay", () => {
    const j = fromLever(LV, {
      id: "abc-1",
      text: "Data Engineer",
      categories: { location: "New York", team: "Data", commitment: "Full-time" },
      workplaceType: "remote",
      createdAt: 1791566108174,
      hostedUrl: "https://jobs.lever.co/spotify/abc-1",
      descriptionPlain: "Join the data team.",
      lists: [{ text: "Who you are", content: "<li>3 years of Python</li><li>SQL</li>" }],
      salaryRange: { min: 150000, max: 200000, currency: "USD", interval: "per-year-salary" },
    })!;
    expect(j).toMatchObject({ key: "lever:spotify:abc-1", company: "Spotify", location: "New York", remote: true, tags: ["Data", "Full-time"] });
    expect(j.description).toContain("## Who you are");
    expect(j.description).toContain("- 3 years of Python");
    expect(j.salary).toContain("150,000");
  });
});

describe("keeping the index up to date", () => {
  const board = (jobs: unknown[]) => jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ jobs }), { status: 200 }));
  beforeEach(() => {
    rows.length = 0;
  });
  afterEach(() => jest.restoreAllMocks());

  it("adds the openings and, on the next reading, closes the ones the company took down", async () => {
    board([ghJob(1), ghJob(2)]);
    const t1 = new Date("2026-10-18T10:00:00Z");
    expect(await ingestBoard(GH, t1)).toEqual({ board: "greenhouse:stripe", jobs: 2, closed: 0 });
    expect(rows.map((r) => r.active)).toEqual([true, true]);

    jest.restoreAllMocks();
    board([ghJob(2), ghJob(3)]);
    const t2 = new Date("2026-10-18T11:00:00Z");
    expect(await ingestBoard(GH, t2)).toEqual({ board: "greenhouse:stripe", jobs: 2, closed: 1 });
    const byKey = Object.fromEntries(rows.map((r) => [String(r.key), r]));
    expect(byKey["greenhouse:stripe:1"].active).toBe(false);
    expect(+(byKey["greenhouse:stripe:1"].expiresAt as Date) - +t2).toBe(CLOSED_KEPT_MS); // removed two weeks later
    expect(byKey["greenhouse:stripe:2"].active).toBe(true);
    expect(byKey["greenhouse:stripe:3"].active).toBe(true);
    expect(byKey["greenhouse:stripe:2"].firstSeenAt).toEqual(t1); // when it was first seen does not change
  });

  it("closes nothing when a board comes back empty, and nothing when it cannot be read", async () => {
    board([ghJob(1)]);
    await ingestBoard(GH, new Date("2026-10-18T10:00:00Z"));
    jest.restoreAllMocks();
    board([]);
    expect(await ingestBoard(GH, new Date("2026-10-18T11:00:00Z"))).toMatchObject({ jobs: 0, closed: 0 });
    jest.restoreAllMocks();
    jest.spyOn(global, "fetch").mockResolvedValue(new Response("nope", { status: 404 }));
    const bad = await ingestBoard(GH, new Date("2026-10-18T12:00:00Z"));
    expect(bad.error).toMatch(/404/);
    expect(rows[0].active).toBe(true);
  });

  it("reopens a job that comes back", async () => {
    board([ghJob(1)]);
    await ingestBoard(GH, new Date("2026-10-18T10:00:00Z"));
    jest.restoreAllMocks();
    board([ghJob(2)]);
    await ingestBoard(GH, new Date("2026-10-18T11:00:00Z"));
    expect(rows.find((r) => r.key === "greenhouse:stripe:1")?.active).toBe(false);
    jest.restoreAllMocks();
    board([ghJob(1)]);
    await ingestBoard(GH, new Date("2026-10-18T12:00:00Z"));
    const back = rows.find((r) => r.key === "greenhouse:stripe:1")!;
    expect(back.active).toBe(true);
    expect(back.expiresAt).toBeUndefined();
  });
});
