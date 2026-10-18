/** @jest-environment node */
import { fetchJobAdText } from "@/lib/jobAdText";
import { isPartialPosting } from "@/lib/jobSearch";

const PAGE = (body: string) =>
  `<html><body><h1>Remote Software Engineer</h1><a>Apply for this job</a><section class="adp-body mx-4 text-sm">${body}</section><div class="adp-right-col">similar jobs: Java</div></body></html>`;
const BODY = `<p>${"Build services in Python and React with SQL and Docker. ".repeat(8)}</p><ul><li>3+ years of experience</li></ul>`;

describe("reading the whole posting", () => {
  afterEach(() => jest.restoreAllMocks());

  it("opens Adzuna's /details/<id> page instead of the forwarding page, and reads the posting block only", async () => {
    const seen: string[] = [];
    jest.spyOn(global, "fetch").mockImplementation(async (u) => {
      seen.push(String(u));
      return new Response(PAGE(BODY), { status: 200 });
    });
    const text = await fetchJobAdText("https://www.adzuna.com/land/ad/5932599431?se=abc&utm_medium=api", true, 1);
    expect(seen[0]).toBe("https://www.adzuna.com/details/5932599431");
    expect(text).toMatch(/^Title: Remote Software Engineer/);
    expect(text).toContain("Python and React");
    expect(text).toContain("- 3+ years of experience");
    expect(text).not.toContain("similar jobs"); // what is outside the posting is not read
  });

  it("knows a listing that came cut from a board (about 500 characters) from a whole one", () => {
    const base = { source: "adzuna" as const, snippet: "" };
    expect(isPartialPosting({ ...base, description: "x".repeat(500) })).toBe(true);
    expect(isPartialPosting({ ...base, description: "x".repeat(3000) })).toBe(false);
    expect(isPartialPosting({ source: "link", snippet: "", description: "short" })).toBe(false); // an added job is read from its own page
  });
});
