/**
 * @jest-environment node
 */
import { readNdjson } from "@/lib/ndjson";

const streamOf = (chunks: string[]) =>
  new Response(
    new ReadableStream({
      start(c) {
        const enc = new TextEncoder();
        for (const x of chunks) c.enqueue(enc.encode(x));
        c.close();
      },
    })
  );

describe("readNdjson", () => {
  it("hands over each line as it arrives, even when a line is cut between two pieces", async () => {
    const got: unknown[] = [];
    await readNdjson(streamOf(['{"p":8}\n{"p":', '38}\n', '{"done":true,"result":{"score":80}}']), (m) => got.push(m));
    expect(got).toEqual([{ p: 8 }, { p: 38 }, { done: true, result: { score: 80 } }]);
  });

  it("skips lines that are not JSON and lets the caller's errors through", async () => {
    const got: unknown[] = [];
    await readNdjson(streamOf(["oops\n", '{"p":1}\n']), (m) => got.push(m));
    expect(got).toEqual([{ p: 1 }]);
    await expect(readNdjson(streamOf(['{"error":"x"}\n']), () => { throw new Error("boom"); })).rejects.toThrow("boom");
  });
});
