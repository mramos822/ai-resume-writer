const store = new Map<string, Record<string, unknown>>();
let down = false;
jest.mock("@/lib/mongodb", () => ({
  db: {
    collection: () => {
      if (down) throw new Error("store down");
      return {
        createIndex: () => Promise.resolve(),
        findOne: async (q: { uid: string; hash: string }) => store.get(`${q.uid}:${q.hash}`) ?? null,
        updateOne: async (q: { uid: string; hash: string }, u: { $set: Record<string, unknown> }) => {
          store.set(`${q.uid}:${q.hash}`, u.$set);
          return {};
        },
      };
    },
  },
}));
jest.mock("@/lib/aiConfig", () => ({ AI_MODEL: "test" }));

import { cachedAi, jobSignature } from "@/lib/aiCache";
import { promptVersion } from "@/lib/promptVersion";

describe("the answers of the AI are kept by what it was asked", () => {
  beforeEach(() => {
    store.clear();
    down = false;
  });

  it("asks once and then answers from memory, with the same result", async () => {
    const compute = jest.fn(async () => ({ headline: "ok", improvements: ["a"] }));
    const first = await cachedAi("evaluate", "u1", { resume: "r1" }, compute);
    const second = await cachedAi("evaluate", "u1", { resume: "r1" }, compute);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.value).toEqual(first.value);
  });

  it("asks again when anything the AI was given changes", async () => {
    const compute = jest.fn(async () => ({ headline: "ok" }));
    await cachedAi("evaluate", "u1", { resume: "r1", level: "Entry level" }, compute);
    await cachedAi("evaluate", "u1", { resume: "r1 edited", level: "Entry level" }, compute); // another resume
    await cachedAi("evaluate", "u1", { resume: "r1", level: "Senior" }, compute); // another level
    await cachedAi("evaluate", "u1", { resume: "r1", level: "Entry level", v: promptVersion("new prompt") }, compute); // another prompt
    expect(compute).toHaveBeenCalledTimes(4);
  });

  it("never shares an answer between two people", async () => {
    const compute = jest.fn(async () => ({ headline: "ok" }));
    await cachedAi("evaluate", "u1", { resume: "same" }, compute);
    const other = await cachedAi("evaluate", "u2", { resume: "same" }, compute);
    expect(other.cached).toBe(false);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("keeps the answers of different kinds apart", async () => {
    const compute = jest.fn(async () => ({ headline: "ok" }));
    await cachedAi("evaluate", "u1", { x: 1 }, compute);
    const other = await cachedAi("questions", "u1", { x: 1 }, compute);
    expect(other.cached).toBe(false);
  });

  it("does not keep an answer that is not a real one (a failed call comes back empty)", async () => {
    let answer: { headline: string } = { headline: "" };
    const compute = jest.fn(async () => answer);
    const usable = (v: { headline: string }) => v.headline.length > 0;
    await cachedAi("evaluate", "u1", { resume: "r" }, compute, usable);
    answer = { headline: "now it works" };
    const second = await cachedAi("evaluate", "u1", { resume: "r" }, compute, usable);
    expect(second.cached).toBe(false); // the empty answer was not kept, so it asked again
    expect(second.value.headline).toBe("now it works");
    const third = await cachedAi("evaluate", "u1", { resume: "r" }, compute, usable);
    expect(third.cached).toBe(true);
  });

  it("asks again on purpose when a new one is requested, and keeps the new one", async () => {
    let n = 0;
    const compute = jest.fn(async () => ({ headline: `answer ${++n}` }));
    await cachedAi("evaluate", "u1", { resume: "r" }, compute);
    const fresh = await cachedAi("evaluate", "u1", { resume: "r" }, compute, () => true, true);
    expect(fresh.cached).toBe(false);
    expect(fresh.value.headline).toBe("answer 2");
    const after = await cachedAi("evaluate", "u1", { resume: "r" }, compute);
    expect(after.cached).toBe(true);
    expect(after.value.headline).toBe("answer 2");
  });

  it("still answers when the store is down", async () => {
    down = true;
    const compute = jest.fn(async () => ({ headline: "ok" }));
    const r = await cachedAi("evaluate", "u1", { resume: "r" }, compute);
    expect(r.value.headline).toBe("ok");
    expect(r.cached).toBe(false);
  });
});

describe("what identifies a job and a prompt", () => {
  const job = { key: "k", title: "Dev", company: "Acme", tags: ["a"], description: "text" };
  it("changes with the posting text, not with anything else", () => {
    expect(jobSignature(job)).toEqual(jobSignature({ ...job }));
    expect(jobSignature(job).text).not.toBe(jobSignature({ ...job, description: "other text" }).text);
  });
  it("a prompt version changes when the prompt is edited", () => {
    expect(promptVersion("a")).toBe(promptVersion("a"));
    expect(promptVersion("a")).not.toBe(promptVersion("b"));
  });
});
