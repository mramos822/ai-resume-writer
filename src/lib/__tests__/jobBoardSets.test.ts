/** @jest-environment node */
import { BOARDS, CT_BOARDS, FAST_BOARDS, FEED_BOARDS, SLOW_BOARDS } from "@/lib/ingest/boards";

const id = (b: { source: string; token: string }) => `${b.source}:${b.token}`;

describe("the sets of boards that are read in one call each", () => {
  it("do not overlap and together are every board that is read on a schedule", () => {
    const all = [...FAST_BOARDS, ...FEED_BOARDS, ...SLOW_BOARDS, ...CT_BOARDS].map(id);
    expect(new Set(all).size).toBe(all.length); // none in two sets
    expect(new Set(BOARDS.map(id))).toEqual(new Set([...FAST_BOARDS, ...FEED_BOARDS, ...SLOW_BOARDS].map(id))); // every board is in one (Computrabajo is read apart, board by board)
  });

  it("keep the feeds apart from the company boards, so neither call goes over the minute of the free host", () => {
    expect(FEED_BOARDS.map((b) => b.source).sort()).toEqual(["arbeitnow", "getonboard", "jobicy", "remoteok", "remotive", "usajobs"]);
    expect(FAST_BOARDS.every((b) => ["greenhouse", "lever", "ashby", "workable", "recruitee", "teamtailor"].includes(b.source))).toBe(true);
    expect(FAST_BOARDS.length).toBeGreaterThan(100);
  });
});
