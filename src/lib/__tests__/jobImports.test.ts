/** @jest-environment node */
import type { JobListing } from "@/lib/jobSearch";

// a tiny in-memory stand-in for the collections
const store: Record<string, Record<string, unknown>[]> = {};
const match = (d: Record<string, unknown>, f: Record<string, unknown>) => Object.entries(f).every(([k, v]) => d[k] === v);
const collection = (name: string) => {
  const rows = (store[name] ??= []);
  return {
    findOne: async (f: Record<string, unknown>) => rows.find((d) => match(d, f)) ?? null,
    updateOne: async (f: Record<string, unknown>, u: { $set: Record<string, unknown> }) => {
      const hit = rows.find((d) => match(d, f));
      if (hit) Object.assign(hit, u.$set);
      else rows.push({ ...u.$set });
    },
  };
};
jest.mock("@/lib/mongodb", () => ({ db: { collection: (n: string) => collection(n) } }));
jest.mock("@/lib/ingest/run", () => ({ index: () => collection("jobs_index") }));
jest.mock("@/lib/migrations", () => ({ runMigrations: async () => undefined }));

import { cachedImport, IMPORT_KEPT_MS, importKey, jobByKey, normalizeUrl, rememberImport } from "@/lib/jobImports";

const job = (over: Partial<JobListing> = {}): JobListing => ({ key: "x", source: "link", title: "Backend Developer", company: "Acme", location: "Lima", remote: false, url: "https://acme.example/jobs/1", postedAt: "", tags: [], snippet: "s", description: "d".repeat(100), ...over });

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe("the address of a posting", () => {
  it("is the same posting however the link was copied", () => {
    const a = "https://Acme.example/jobs/1/?utm_source=x&utm_medium=y#section";
    const b = "https://acme.example/jobs/1";
    expect(normalizeUrl(a)).toBe("https://acme.example/jobs/1");
    expect(importKey(a)).toBe(importKey(b));
    expect(importKey("https://acme.example/jobs/2")).not.toBe(importKey(b));
  });

  it("keeps the parts that make it another posting, and ignores the marks of a search on Adzuna", () => {
    expect(importKey("https://acme.example/job?id=1")).not.toBe(importKey("https://acme.example/job?id=2"));
    expect(importKey("https://www.adzuna.com/land/ad/123?se=abc&v=111")).toBe(importKey("https://www.adzuna.com/land/ad/123?se=zzz&v=222"));
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("the postings added by link", () => {
  it("come back for the next person with the same link, as the same job", async () => {
    expect(await cachedImport("https://acme.example/jobs/1")).toBeNull();
    await rememberImport("https://acme.example/jobs/1?utm_source=mail", job());
    const again = await cachedImport("https://acme.example/jobs/1#apply");
    expect(again?.title).toBe("Backend Developer");
    expect(again?.key).toBe(importKey("https://acme.example/jobs/1"));
  });

  it("are not served after their time", async () => {
    await rememberImport("https://acme.example/jobs/1", job());
    (store.job_imports[0] as { expiresAt: Date }).expiresAt = new Date(Date.now() - 1000);
    expect(await cachedImport("https://acme.example/jobs/1")).toBeNull();
    expect(IMPORT_KEPT_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it("can be found by their key, and so can a job of the index; a job that is not kept is not found", async () => {
    await rememberImport("https://acme.example/jobs/1", job());
    expect((await jobByKey(importKey("https://acme.example/jobs/1")))?.company).toBe("Acme");
    store.jobs_index = [{ key: "greenhouse:acme:9", active: true, source: "greenhouse", title: "Data Analyst", company: "Acme", location: "NY", remote: false, url: "https://boards.greenhouse.io/acme/jobs/9", postedAt: "2026-10-01", tags: [], snippet: "s", description: "d".repeat(100), board: "greenhouse:acme" }];
    const found = await jobByKey("greenhouse:acme:9");
    expect(found?.title).toBe("Data Analyst");
    expect(found).not.toHaveProperty("board");
    expect(await jobByKey("adzuna:123")).toBeNull();
    expect(await jobByKey("link:doesnotexist")).toBeNull();
  });
});
