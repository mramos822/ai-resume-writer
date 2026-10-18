/** @jest-environment node */
import { countryOf } from "@/lib/ingest/country";
import { payFromText } from "@/lib/ingest/pay";
import { ageStep, byFreshnessThenFit } from "@/lib/jobRank";
import { activeFilters, levelBand, matchesFilters, NO_FILTERS } from "@/lib/jobFilters";
import { levelOf } from "@/lib/jobLevel";
import { fromAshby, fromGreenhouse, fromLever, fromSmartRecruiters } from "@/lib/ingest/ats";
import type { Board } from "@/lib/ingest/boards";
import type { JobListing } from "@/lib/jobSearch";

describe("the country of a job", () => {
  it("reads it from how the place is written", () => {
    expect(countryOf("Newark, NJ")).toBe("US");
    expect(countryOf("Austin, TX, United States")).toBe("US");
    expect(countryOf("United States | Remote")).toBe("US");
    expect(countryOf("San Francisco")).toBe("US");
    expect(countryOf("New York City")).toBe("US");
    expect(countryOf("London, , United Kingdom")).toBe("GB");
    expect(countryOf("Remote - India")).toBe("IN");
    expect(countryOf("Bengaluru")).toBe("IN");
    expect(countryOf("São Paulo, SP, Brazil")).toBe("BR");
    expect(countryOf("Radomlje, SLOVENIA, Slovenia")).toBe("SI");
    expect(countryOf("Toronto, ON")).toBe("CA");
    expect(countryOf("Mohali, IND")).toBe("IN");
    expect(countryOf("Addison, TX (Hybrid); Bellevue, WA (Hybrid)")).toBe("US");
    expect(countryOf("Zürich, CH")).toBe("CH");
    expect(countryOf("Bucharest")).toBe("RO");
    expect(countryOf("Doha, Qatar")).toBe("QA");
    expect(countryOf("Wilmington, DE")).toBe("US"); // a US state, not Germany
    expect(countryOf("Indianapolis, IN")).toBe("US"); // a US state, not India
  });

  it("takes what the board says when it says it, and leaves unknown what is not clear", () => {
    expect(countryOf("Hybrid", "mx")).toBe("MX");
    expect(countryOf("Remote")).toBeUndefined();
    expect(countryOf("Multiple locations")).toBeUndefined();
    expect(countryOf("")).toBeUndefined();
    expect(countryOf("Somewhere", "Germany")).toBe("DE");
  });
});

describe("the pay a posting names", () => {
  it("takes the range of a yearly salary", () => {
    expect(payFromText("The expected base pay range for this position in the New York City area is $145,000 - $215,000 per year plus equity.")).toBe("$145,000 – $215,000");
    expect(payFromText("Salary: $120K to $160K")).toBe("$120,000 – $160,000");
    expect(payFromText("£70,000 – £90,000 depending on experience")).toBe("£70,000 – £90,000");
  });

  it("knows an hourly range, and leaves out what is not a range of pay", () => {
    expect(payFromText("Pay is $45 - $60 per hour")).toBe("$45 – $60 per hour");
    expect(payFromText("The pay range for this role in New Jersey is $29 / hr - $53.50 / hr.This is not a guarantee")).toBe("$29 – $53.50 per hour");
    expect(payFromText("Pay: $29/hr to $53.50/hr")).toBe("$29 – $53.50 per hour");
  });

  it("reads the other ways postings write their pay (seen in real postings)", () => {
    expect(payFromText("Compensation for this role is $30/hour. This is a contract")).toBe("$30 per hour");
    expect(payFromText("Orlando, FL: $15.25 per hour - The salary range")).toBe("$15.25 per hour");
    expect(payFromText("Salary Range: USD $18.80/hr - The salary range")).toBe("$18.80 per hour");
    expect(payFromText("The base pay range in the Toronto area is CAD $45 - CAD $48 per hour, not inclusive")).toBe("CAD $45 – $48 per hour");
    expect(payFromText("The expected salary range for this role is $240,000 CAD - $300,000 CAD. However")).toBe("CAD $240,000 – $300,000");
    expect(payFromText("The typical starting salary range for this role is: €80.400 - €127.200 EUR Additional")).toBe("€80,400 – €127,200");
    expect(payFromText("The estimated salary for this position is estimated to be $10,000/month. Further note")).toBe("$10,000 per month");
    expect(payFromText("Lithuania Gross Monthly Pay Range €6.083 - €7.083 EUR Click here")).toBe("€6,083 – €7,083 per month");
    expect(payFromText("Hourly Rate: $50 - $50 USD - Application Limit")).toBe("$50 per hour");
    expect(payFromText("The expected base pay range for this position in San Francisco is $200-240K. In addition")).toBe("$200,000 – $240,000");
    expect(payFromText("The expected range of pay for this position in the U.S. is $17.84 - $22.30. Salary ranges")).toBe("$17.84 – $22.30 per hour");
    expect(payFromText("Annual base salary range (excluding equity and bonus): R$347.900 - R$359.200 BRL - Application")).toBe("R$347,900 – R$359,200");
  });

  it("does not take the figures of the company for the pay of the job", () => {
    expect(payFromText("Carta: a $5.8B valuation, more than $1 billion in annualized bookings, $250B+ in assets")).toBeUndefined();
    expect(payFromText("Stripe processes over $1.9T in payments volume per year")).toBeUndefined();
    expect(payFromText("generating $5M+ ARR and an average deal size of $100k+")).toBeUndefined();
    expect(payFromText("Annual Salary: $1 - $2 USD")).toBeUndefined();
    expect(payFromText("Monthly contribution up to $200 to help you pay off your student loans")).toBeUndefined();
    expect(payFromText("We raised $50 - $200 million")).toBeUndefined(); // not a salary
    expect(payFromText("Between $1,000 and $90,000 of equipment")).toBeUndefined(); // too wide to be one range
    expect(payFromText("No pay is listed here.")).toBeUndefined();
  });
});

describe("the order: the most recent first, then the better fit", () => {
  const NOW = Date.parse("2026-10-18T12:00:00Z");
  const ago = (days: number) => new Date(NOW - days * 86400000).toISOString();
  it("steps by age", () => {
    expect([ageStep(ago(0), NOW), ageStep(ago(1.5), NOW), ageStep(ago(5), NOW), ageStep(ago(10), NOW), ageStep(ago(20), NOW), ageStep(ago(60), NOW), ageStep(ago(400), NOW), ageStep("", NOW)]).toEqual([0, 0, 1, 2, 3, 4, 5, 5]);
  });

  it("puts a recent job with a modest fit before an old one with a great fit, and the better fit first between two of the same age", () => {
    const jobs = [
      { id: "old-great", postedAt: ago(40), fit: 95 },
      { id: "today-modest", postedAt: ago(0.2), fit: 40 },
      { id: "today-great", postedAt: ago(0.5), fit: 90 },
      { id: "week", postedAt: ago(5), fit: 99 },
    ];
    expect(jobs.sort((a, b) => byFreshnessThenFit(a, b, NOW)).map((j) => j.id)).toEqual(["today-great", "today-modest", "week", "old-great"]);
  });
});

const job = (over: Partial<JobListing> = {}): JobListing => ({ key: "k", source: "greenhouse", title: "Software Engineer", company: "Co", location: "NY", remote: false, url: "https://x.test", postedAt: "", tags: [], snippet: "", description: "", ...over });

describe("the filters a person chooses", () => {
  const NOW = Date.parse("2026-10-18T12:00:00Z");
  it("keeps what was posted within the days chosen, and drops what has no date", () => {
    const f = { ...NO_FILTERS, posted: 7 as const };
    expect(matchesFilters(job({ postedAt: new Date(NOW - 3 * 86400000).toISOString() }), f, NOW)).toBe(true);
    expect(matchesFilters(job({ postedAt: new Date(NOW - 9 * 86400000).toISOString() }), f, NOW)).toBe(false);
    expect(matchesFilters(job({ postedAt: "" }), f, NOW)).toBe(false);
    expect(matchesFilters(job({ postedAt: "" }), NO_FILTERS, NOW)).toBe(true);
  });

  it("filters by the level the job asks for", () => {
    const entry = job({ title: "Junior Developer" });
    const mid = job({ description: "3+ years of professional experience building web apps." });
    const senior = job({ title: "Senior Software Engineer" });
    const unknown = job({ description: "Build things with a great team." });
    expect([entry, mid, senior, unknown].map(levelBand)).toEqual(["entry", "mid", "senior", "unknown"]);
    const pass = (level: "entry" | "mid" | "senior") => [entry, mid, senior, unknown].map((j) => matchesFilters(j, { ...NO_FILTERS, level }, NOW));
    expect(pass("entry")).toEqual([true, false, false, true]);
    expect(pass("mid")).toEqual([false, true, false, true]);
    expect(pass("senior")).toEqual([false, false, true, false]);
  });

  it("keeps only the jobs that name their pay when asked, and counts the filters that are on", () => {
    expect(matchesFilters(job({ salary: "$100,000 – $120,000" }), { ...NO_FILTERS, pay: true }, NOW)).toBe(true);
    expect(matchesFilters(job(), { ...NO_FILTERS, pay: true }, NOW)).toBe(false);
    expect(activeFilters(NO_FILTERS)).toBe(0);
    expect(activeFilters({ ...NO_FILTERS, sort: "fit" })).toBe(0); // the order is not a filter
    expect(activeFilters({ sort: "recent", posted: 3, level: "mid", pay: true, lang: "all" })).toBe(4);
  });
});

describe("the level of a job", () => {
  it("does not take an Account Manager for a manager of people", () => {
    expect(levelOf({ title: "Account Manager", description: "", snippet: "" }).years).toBe(3);
    expect(levelOf({ title: "Product Manager", description: "", snippet: "" }).years).toBe(3);
    expect(levelOf({ title: "Engineering Manager", description: "", snippet: "" }).years).toBe(6);
    expect(levelOf({ title: "Senior Manager, Data", description: "", snippet: "" }).years).toBe(6);
  });

  it("does not let a figure about one tool lower a senior title below two years of its usual number", () => {
    expect(levelOf({ title: "Senior Software Engineer", description: "2+ years of experience with Python", snippet: "" }).years).toBe(3);
    expect(levelOf({ title: "Staff Engineer", description: "1 year of experience with mobile", snippet: "" }).years).toBe(6);
    expect(levelOf({ title: "Senior Software Engineer", description: "7+ years of experience", snippet: "" }).years).toBe(7);
  });
});

describe("remote, hybrid and on-site, as the board says it", () => {
  it("an Ashby hybrid job is not remote even when isRemote says so", () => {
    const B: Board = { source: "ashby", token: "openai" };
    const base = { id: "1", title: "Engineer", jobUrl: "https://jobs.ashbyhq.com/x/1", descriptionHtml: "<p>Build things for a living every day, with a great team of colleagues.</p>", location: "New York City" };
    expect(fromAshby(B, { ...base, isRemote: true, workplaceType: "Hybrid" })!.remote).toBe(false);
    expect(fromAshby(B, { ...base, isRemote: true, workplaceType: "OnSite" })!.remote).toBe(false);
    expect(fromAshby(B, { ...base, isRemote: true, workplaceType: "Remote" })!.remote).toBe(true);
    expect(fromAshby(B, { ...base, location: "Remote - US", isRemote: null, workplaceType: undefined })!.remote).toBe(true);
    expect(fromAshby(B, { ...base })!.country).toBe("US");
  });

  it("a SmartRecruiters hybrid job is not remote", () => {
    const B: Board = { source: "smartrecruiters", token: "Sodexo" };
    const detail = { postingUrl: "https://jobs.smartrecruiters.com/Sodexo/1", jobAd: { sections: { jobDescription: { title: "Job", text: "<p>Prepare meals for our clients every day, following the recipes and the rules of the kitchen.</p>" } } } };
    expect(fromSmartRecruiters(B, { id: "1", name: "Cook", location: { fullLocation: "Newark, NJ", remote: true, hybrid: true, country: "us" } }, detail)!.remote).toBe(false);
    expect(fromSmartRecruiters(B, { id: "2", name: "Cook", location: { fullLocation: "Newark, NJ", remote: true, hybrid: false, country: "us" } }, detail)!.remote).toBe(true);
    expect(fromSmartRecruiters(B, { id: "3", name: "Cook", location: { fullLocation: "Newark, NJ", country: "us" } }, detail)!.country).toBe("US");
  });

  it("the pay and the country come with Greenhouse and Lever postings", () => {
    const g = fromGreenhouse({ source: "greenhouse", token: "lyft" }, { id: 1, title: "Data Scientist", absolute_url: "https://boards.greenhouse.io/lyft/jobs/1", location: { name: "New York, NY" }, content: "&lt;p&gt;The expected base pay range for this position is $150,000 - $190,000.&lt;/p&gt;" })!;
    expect(g.salary).toBe("$150,000 – $190,000");
    expect(g.country).toBe("US");
    const l = fromLever({ source: "lever", token: "spotify" }, { id: "a", text: "Designer", hostedUrl: "https://jobs.lever.co/spotify/a", categories: { location: "Mexico City" }, country: "MX", descriptionPlain: "Design things." })!;
    expect(l.country).toBe("MX");
  });
});
