/** @jest-environment node */
import type { JobListing } from "@/lib/jobSearch";

// a tiny in-memory stand-in for the two collections the catalog uses
const store: Record<string, Record<string, unknown>[]> = {};
const matches = (doc: Record<string, unknown>, filter: Record<string, unknown>) =>
  Object.entries(filter).every(([k, v]) => (v && typeof v === "object" && "$in" in (v as object) ? ((v as { $in: unknown[] }).$in).includes(doc[k]) : doc[k] === v));
const collection = (name: string) => {
  const rows = (store[name] ??= []);
  return {
    findOne: async (f: Record<string, unknown>) => rows.find((d) => matches(d, f)) ?? null,
    find: (f: Record<string, unknown>) => {
      const cursor = { project: () => cursor, toArray: async () => rows.filter((d) => matches(d, f)) };
      return cursor;
    },
    updateOne: async (f: Record<string, unknown>, u: { $set: Record<string, unknown> }) => {
      const hit = rows.find((d) => matches(d, f));
      if (hit) Object.assign(hit, u.$set);
      else rows.push({ ...u.$set });
    },
    bulkWrite: async (ops: { updateOne: { filter: Record<string, unknown>; update: { $set: Record<string, unknown> } } }[]) => {
      for (const o of ops) {
        const hit = rows.find((d) => matches(d, o.updateOne.filter));
        if (hit) Object.assign(hit, o.updateOne.update.$set);
        else rows.push({ ...o.updateOne.update.$set });
      }
    },
  };
};
jest.mock("@/lib/mongodb", () => ({ db: { collection: (n: string) => collection(n) } }));

import { ADZUNA_TTL, cachedSearch, KEEP, knownPays, QUERY_TTL, rememberPays, rememberSearch, searchKey, withKnownPay, withKnownText } from "@/lib/jobCatalog";

const job = (key: string, source: JobListing["source"], description: string): JobListing => ({ key, source, title: "Dev", company: "A", location: "NY", remote: false, url: "https://x.test/" + key, postedAt: "", tags: [], snippet: "", description });

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe("job catalog", () => {
  it("gives back a search that was just made, exactly as it was", async () => {
    const qkey = searchKey([true, "Software Engineer ", "", false, "us", ""]);
    expect(qkey).toBe(searchKey([true, "software engineer", "", false, "us", ""]));
    expect(await cachedSearch(qkey)).toBeNull();
    await rememberSearch(qkey, { jobs: [job("adzuna:1", "adzuna", "x".repeat(900))], sources: ["Adzuna"], bigCity: undefined });
    const again = await cachedSearch(qkey);
    expect(again?.jobs).toHaveLength(1);
    expect(again?.sources).toEqual(["Adzuna"]);
  });

  it("does not serve a search that is older than the time it is kept", async () => {
    await rememberSearch("q", { jobs: [job("a", "adzuna", "x")], sources: [] });
    (store.job_queries[0] as { at: Date }).at = new Date(Date.now() - QUERY_TTL - 1000);
    expect(await cachedSearch("q")).toBeNull();
  });

  it("remembers Adzuna's part of a search for hours, longer than the quick ones", async () => {
    expect(ADZUNA_TTL).toBeGreaterThan(QUERY_TTL);
    await rememberSearch("slow", { jobs: [job("adzuna:9", "adzuna", "x")], sources: ["Adzuna"] }, ADZUNA_TTL);
    const doc = store.job_queries.find((d) => d.qkey === "slow") as { at: Date; expiresAt: Date };
    expect(+doc.expiresAt - +doc.at).toBe(ADZUNA_TTL);
    doc.at = new Date(Date.now() - QUERY_TTL - 1000); // older than the quick ones are kept
    expect(await cachedSearch("slow")).toBeNull();
    expect((await cachedSearch("slow", ADZUNA_TTL))?.jobs).toHaveLength(1);
  });

  it("keeps every job with a date to expire, a day for Adzuna", async () => {
    await rememberSearch("q", { jobs: [job("adzuna:1", "adzuna", "x"), job("remotive:1", "remotive", "y")], sources: [] });
    const [a, r] = store.job_catalog as { key: string; savedAt: Date; expiresAt: Date }[];
    expect(+a.expiresAt - +a.savedAt).toBe(KEEP.adzuna);
    expect(+r.expiresAt - +r.savedAt).toBe(KEEP.remotive);
    expect(KEEP.adzuna).toBeLessThan(KEEP.remotive);
  });

  it("gives a job that came cut the whole text an earlier reading kept (and nothing else)", async () => {
    const whole = "w".repeat(2000);
    await rememberSearch("q", { jobs: [job("adzuna:1", "adzuna", whole), job("adzuna:2", "adzuna", "short")], sources: [] });
    const out = await withKnownText([job("adzuna:1", "adzuna", "cut text…"), job("adzuna:2", "adzuna", "cut text…"), job("adzuna:3", "adzuna", "cut text…")]);
    expect(out[0].description).toBe(whole);
    expect(out[1].description).toBe("cut text…"); // what was kept is not whole either
    expect(out[2].description).toBe("cut text…"); // never seen
  });

  it("ignores text kept past its date", async () => {
    await rememberSearch("q", { jobs: [job("adzuna:1", "adzuna", "w".repeat(2000))], sources: [] });
    (store.job_catalog[0] as { expiresAt: Date }).expiresAt = new Date(Date.now() - 1000);
    expect((await withKnownText([job("adzuna:1", "adzuna", "cut")]))[0].description).toBe("cut");
  });
});

describe("the pay read from a posting", () => {
  it("is remembered for the job, and a job read that names none is remembered too", async () => {
    await rememberPays([
      { key: "adzuna:1", source: "adzuna", pay: "$29 – $53.50 per hour" },
      { key: "adzuna:2", source: "adzuna", pay: null },
    ]);
    expect(await knownPays(["adzuna:1", "adzuna:2", "adzuna:3"])).toEqual({ "adzuna:1": "$29 – $53.50 per hour", "adzuna:2": null }); // :3 was never read
  });

  it("fills the jobs that came without pay, and leaves the ones that have it", async () => {
    await rememberPays([{ key: "adzuna:1", source: "adzuna", pay: "$30 per hour" }]);
    const jobs = await withKnownPay([job("adzuna:1", "adzuna", "x"), { ...job("adzuna:4", "adzuna", "x"), salary: "$90,000" }, job("adzuna:5", "adzuna", "x")]);
    expect(jobs.map((j) => j.salary)).toEqual(["$30 per hour", "$90,000", undefined]);
  });

  it("is not erased when the same job comes in a later search without a pay", async () => {
    await rememberPays([{ key: "adzuna:1", source: "adzuna", pay: "$30 per hour" }]);
    await rememberSearch("later", { jobs: [job("adzuna:1", "adzuna", "x".repeat(900))], sources: ["Adzuna"] });
    expect((await knownPays(["adzuna:1"]))["adzuna:1"]).toBe("$30 per hour");
  });
});
