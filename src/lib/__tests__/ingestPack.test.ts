/** @jest-environment node */
import { Binary } from "mongodb";
import { packDescription, unpackDescription } from "@/lib/ingest/pack";

const long = ("We are looking for an engineer to build web apps with React and Node.js. Ingeniería de software, atención al cliente. " + "Responsibilities include code review and testing. ").repeat(30);

describe("the description of a job in the index", () => {
  it("is kept compressed (much smaller) and comes back exactly as it was", () => {
    const doc = { key: "greenhouse:x:1", title: "Engineer", description: long, snippet: "We are looking…" };
    const packed = packDescription(doc) as Record<string, unknown>;
    expect(packed.description).toBeUndefined();
    expect(packed.descZ).toBeInstanceOf(Binary);
    expect((packed.descZ as Binary).length()).toBeLessThan(long.length / 4);
    expect(unpackDescription(packed)).toEqual(doc);
  });

  it("leaves a short text, a document with no text and a plain document as they are", () => {
    expect(packDescription({ key: "a", description: "short" })).toEqual({ key: "a", description: "short" });
    expect(packDescription({ key: "a" })).toEqual({ key: "a" });
    expect(unpackDescription({ key: "a", description: long })).toEqual({ key: "a", description: long });
  });

  it("does not fail on a damaged text: the job is read without it", () => {
    const out = unpackDescription({ key: "a", snippet: "s", descZ: new Binary(Buffer.from("not brotli")) } as never) as Record<string, unknown>;
    expect(out.description).toBeUndefined();
    expect(out.descZ).toBeUndefined();
    expect(out.snippet).toBe("s");
  });
});
