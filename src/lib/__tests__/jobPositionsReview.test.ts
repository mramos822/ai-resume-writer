/** @jest-environment node */
// Cases found by reviewing real positions one by one (Cloudflare, MongoDB, Bosch, Arbeitnow).
import { levelOf, withoutPlus } from "@/lib/jobLevel";
import { fromArbeitnow, fromGreenhouse } from "@/lib/ingest/ats";
import { isCountryName } from "@/lib/ingest/country";
import type { Board } from "@/lib/ingest/boards";

describe("what is only a plus is cut, and nothing after it", () => {
  // Cloudflare lists its "Nice to have" first, and its requirements come later in the text
  const CLOUDFLARE = [
    "## About the role",
    "Build the data platform.",
    "",
    "Responsibilities",
    "- Design systems",
    "",
    "Nice to have:",
    "- Experience with Spark",
    "- Experience with Kafka",
    "",
    "We know that great candidates come from diverse backgrounds. You don't need to tick every single box. Please apply.",
    "",
    "- 10+ years of software engineering experience with a demonstrated history of leading complex data initiatives.",
    "- Strong communication skills",
  ].join("\n");

  it("takes out the bullets under the heading and keeps the requirements that come later", () => {
    const cut = withoutPlus(CLOUDFLARE);
    expect(cut).not.toContain("Spark");
    expect(cut).toContain("10+ years of software engineering experience");
    expect(cut).toContain("Design systems");
  });

  it("asks for the 10 years the text says, not the usual 8 of a Principal", () => {
    expect(levelOf({ title: "Principal Engineer - GTM Data Platform", description: CLOUDFLARE, snippet: "" })).toEqual({ label: "Principal", years: 10 });
  });

  it("still cuts a plus written as plain lines, up to the next paragraph", () => {
    const raw = "Minimum qualifications:\n2 years of experience in software.\n\nPreferred qualifications:\n9 years of experience with Java\nA PhD\n\nAbout the job\nBuild things.";
    expect(levelOf({ title: "Software Engineer", description: raw, snippet: "" }).years).toBe(2);
  });
});

describe("the level of a position, by its title", () => {
  it("a Senior Product Manager is a senior individual role, a Senior Manager is a manager of managers", () => {
    expect(levelOf({ title: "Senior Product Manager, Client Libraries", description: "5+ years of experience in product management", snippet: "" })).toEqual({ label: "Senior", years: 5 });
    expect(levelOf({ title: "Senior Manager, Data", description: "", snippet: "" })).toEqual({ label: "Manager", years: 6 });
    expect(levelOf({ title: "Senior Engineering Manager", description: "", snippet: "" }).label).toBe("Manager");
  });

  it("an undergraduate program or a student job is entry level", () => {
    expect(levelOf({ title: "Bosch Undergraduate Program", description: "", snippet: "" }).label).toBe("Entry level");
    expect(levelOf({ title: "Student Assistant, Marketing", description: "", snippet: "" }).label).toBe("Entry level");
    expect(levelOf({ title: "Software Engineer Co-op", description: "", snippet: "" }).label).toBe("Entry level");
  });
});

describe("the place of a position", () => {
  const G: Board = { source: "greenhouse", token: "mongodb", name: "MongoDB" };
  const gh = (name: string) => fromGreenhouse(G, { id: 1, title: "Senior Product Manager", absolute_url: "https://boards.greenhouse.io/mongodb/jobs/1", location: { name }, content: "&lt;p&gt;This role can be in-office, flexible (hybrid), or remote in the United States.&lt;/p&gt;" })!;

  it("knows a place that is only a country", () => {
    expect(isCountryName("United States")).toBe(true);
    expect(isCountryName("Canada")).toBe(true);
    expect(isCountryName("New York, NY")).toBe(false);
    expect(isCountryName("San Francisco")).toBe(false);
    expect(isCountryName("")).toBe(false);
  });

  it("a Greenhouse job placed only in a country is open to the whole country (remote); one placed in a city is not", () => {
    expect(gh("United States").remote).toBe(true);
    expect(gh("New York, NY").remote).toBe(false);
    expect(gh("Remote - US").remote).toBe(true);
    expect(gh("Canada").remote).toBe(true);
    expect(gh("Singapore").remote).toBe(false); // a city-state: an office, not a remote job
    expect(gh("Germany").remote).toBe(false);
  });

  it("an Arbeitnow job whose place does not say its country is a European one", () => {
    const A: Board = { source: "arbeitnow", token: "all" };
    const j = (location: string) => fromArbeitnow(A, { slug: "s-" + location, title: "Quality Manager", url: "https://www.arbeitnow.com/jobs/s", description: "<p>Lead the quality team.</p>", location })!;
    expect(j("Nyon").country).toBe("EU");
    expect(j("Berlin").country).toBe("DE");
  });
});
