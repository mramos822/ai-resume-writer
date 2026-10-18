import { alternatesFor } from "@/lib/seo";

describe("alternatesFor", () => {
  it("a page names its own address, not the home page", () => {
    expect(alternatesFor("/privacy", "en").canonical).toBe("/privacy");
    expect(alternatesFor("/", "en").canonical).toBe("/");
  });

  it("the Spanish version is its own page and the two point at each other", () => {
    const es = alternatesFor("/privacy", "es");
    expect(es.canonical).toBe("/es/privacy");
    expect(es.languages).toEqual({ en: "/privacy", es: "/es/privacy", "x-default": "/privacy" });
    expect(alternatesFor("/", "es").canonical).toBe("/es");
  });
});
