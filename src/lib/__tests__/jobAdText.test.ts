/** @jest-environment node */
import { fetchJobAdPage, fetchJobAdText } from "@/lib/jobAdText";
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

describe("the pay a page publishes in its data", () => {
  afterEach(() => jest.restoreAllMocks());

  const ld = (baseSalary: unknown) =>
    `<html><head><script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", title: "Asistente de monitoreo GPS", description: "<p>" + "Monitoreo de unidades GPS en tiempo real. ".repeat(10) + "</p>", hiringOrganization: { name: "QREPS" }, baseSalary })}</script></head><body></body></html>`;
  const read = async (baseSalary: unknown) => {
    jest.spyOn(global, "fetch").mockImplementation(async () => new Response(ld(baseSalary), { status: 200 }));
    return fetchJobAdText("https://pe.example.com/ofertas/1", true, 1);
  };

  it("is put at the top of the text as a line, in its own money", async () => {
    expect(await read({ "@type": "MonetaryAmount", currency: "PEN", value: { "@type": "QuantitativeValue", value: 1530, unitText: "MONTH" } })).toContain("Salary: S/ 1,530 per month");
    expect(await read({ currency: "USD", value: { minValue: 90000, maxValue: 120000, unitText: "YEAR" } })).toContain("Salary: $90,000 – $120,000");
    expect(await read({ currency: "MXN", value: { value: 15000, unitText: "MONTH" } })).toContain("Salary: MXN 15,000 per month");
  });

  it("is left out when the page gives none", async () => {
    expect(await read(undefined)).not.toContain("Salary:");
  });
});

describe("a site that asks for a check that only a person can pass", () => {
  afterEach(() => jest.restoreAllMocks());
  const CHECK = "<html><head><title>Just a moment...</title></head><body>Enable JavaScript and cookies to continue</body></html>";

  it("is recognised at once and not insisted on: one request, and the reason is told", async () => {
    const spy = jest.spyOn(global, "fetch").mockImplementation(async () => new Response(CHECK, { status: 403, headers: { "cf-mitigated": "challenge" } }));
    expect(await fetchJobAdPage("https://www.ziprecruiter.com/jobs/v2/abc", true)).toEqual({ text: null, blocked: true });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await fetchJobAdText("https://www.ziprecruiter.com/jobs/v2/abc", true)).toBeNull();
  });

  it("is recognised too when the check comes with an ordinary answer", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async () => new Response(CHECK, { status: 200 }));
    expect(await fetchJobAdPage("https://example.com/job", true)).toEqual({ text: null, blocked: true });
  });

  it("is not confused with a page that simply cannot be read", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async () => new Response("not found", { status: 404 }));
    expect(await fetchJobAdPage("https://example.com/job", true, 1)).toEqual({ text: null, blocked: false });
  });
});
