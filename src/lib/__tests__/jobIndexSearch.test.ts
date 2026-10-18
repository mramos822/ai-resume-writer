/** @jest-environment node */
import type { JobQuery } from "@/lib/jobSearch";

let seen: { filter: Record<string, unknown>; options: Record<string, unknown> } | null = null;
jest.mock("@/lib/ingest/run", () => ({
  index: () => ({
    find: (filter: Record<string, unknown>, options: Record<string, unknown>) => {
      seen = { filter, options };
      const cursor = { sort: () => cursor, limit: () => cursor, toArray: async () => [{ key: "greenhouse:x:1", title: "Backend Engineer", score: 3 }] };
      return cursor;
    },
  }),
}));

import { searchIndex } from "@/lib/ingest/searchIndex";

const q = (over: Partial<JobQuery> = {}): JobQuery => ({ q: "backend engineer", location: "", remoteOnly: false, country: "us", ...over });

describe("searching our own index", () => {
  beforeEach(() => {
    seen = null;
  });

  it("looks only at open jobs, by the words typed, in English by default (a job with no language stored counts as English)", async () => {
    const rows = await searchIndex(q());
    expect(seen!.filter).toMatchObject({ active: true, $text: { $search: "backend engineer" }, lang: { $in: ["en", null] } });
    expect(rows).toEqual([{ key: "greenhouse:x:1", title: "Backend Engineer" }]); // the text score is not part of the job
  });

  it("adds Spanish for someone who uses Kaizo in Spanish", async () => {
    await searchIndex(q({ langs: ["en", "es"] }));
    expect(seen!.filter.lang).toEqual({ $in: ["en", "es", null] });
  });

  it("keeps remote jobs only when asked, and takes a place as any of its words, plus the remote jobs", async () => {
    await searchIndex(q({ remoteOnly: true }));
    expect(seen!.filter.remote).toBe(true);
    await searchIndex(q({ location: "Hillside, New Jersey" }));
    expect(seen!.filter.$or).toEqual([{ remote: true }, { location: { $regex: "hillside|new|jersey", $options: "i" } }]);
  });

  it("does not use the text search when nothing was typed", async () => {
    await searchIndex(q({ q: "  " }));
    expect(seen!.filter.$text).toBeUndefined();
  });
});
