/** @jest-environment node */
import { fromRecruitee, fromTeamtailor, fromWorkable } from "@/lib/ingest/ats";
import type { Board } from "@/lib/ingest/boards";

// the shapes below are the ones the three systems really answer (public lists, no key)
describe("reading a Workable posting", () => {
  const B: Board = { source: "workable", token: "huggingface" };
  const job = (over: Record<string, unknown> = {}) => ({
    title: "Open-Source Machine Learning Engineer - EMEA Remote",
    shortcode: "81B46579FE",
    employment_type: "Full-time",
    telecommuting: true,
    department: "Open Source",
    function: "Engineering",
    url: "https://apply.workable.com/j/81B46579FE",
    published_on: "2026-05-29",
    country: "France",
    city: "Paris",
    state: "Île-de-France",
    locations: [{ countryCode: "FR" }],
    description: "<p>Build things.</p><ul><li>5+ years of Python</li></ul><p>The pay range for this role is $29 / hr - $53.50 / hr.</p>",
    ...over,
  });

  it("turns it into a job: the company comes from the account, the place and the remote flag from its fields, the pay from its text", () => {
    const j = fromWorkable(B, job(), "Hugging Face")!;
    expect(j).toMatchObject({ key: "workable:huggingface:81B46579FE", source: "workable", company: "Hugging Face", location: "Paris, Île-de-France, France", remote: true, country: "FR", salary: "$29 – $53.50 per hour", board: "workable:huggingface", tags: ["Open Source", "Engineering", "Full-time"] });
    expect(j.postedAt).toBe("2026-05-29T00:00:00.000Z");
    expect(j.description).toContain("- 5+ years of Python");
    expect(j.description).not.toContain("<");
  });

  it("skips what has no link to apply or no title", () => {
    expect(fromWorkable(B, job({ url: "" }))).toBeNull();
    expect(fromWorkable(B, job({ title: "" }))).toBeNull();
    expect(fromWorkable(B, job({ shortcode: undefined }))).toBeNull();
  });
});

describe("reading a Recruitee posting", () => {
  const B: Board = { source: "recruitee", token: "bunq" };
  const offer = (over: Record<string, unknown> = {}) => ({
    id: 1646,
    title: "Backend Engineer",
    status: "published",
    description: "<p>Build the bank.</p>",
    requirements: "<ul><li>3+ years of Java</li></ul>",
    location: "Amsterdam, Noord-Holland, Netherlands",
    country_code: "NL",
    company_name: "bunq",
    department: "Engineering",
    remote: false,
    hybrid: true,
    careers_url: "https://careers.bunq.com/o/backend-engineer",
    published_at: "2026-10-15 09:31:36 UTC",
    employment_type_code: "fulltime_permanent",
    tags: ["java"],
    salary: { min: null, max: null, period: null, currency: null },
    ...over,
  });

  it("turns it into a job: the requirements join the description, a hybrid job is not a remote one", () => {
    const j = fromRecruitee(B, offer())!;
    expect(j).toMatchObject({ key: "recruitee:bunq:1646", source: "recruitee", company: "bunq", location: "Amsterdam, Noord-Holland, Netherlands", remote: false, country: "NL", board: "recruitee:bunq", tags: ["Engineering", "fulltime permanent", "java"] });
    expect(j.postedAt).toBe("2026-10-15T09:31:36.000Z");
    expect(j.description).toContain("Requirements");
    expect(j.description).toContain("- 3+ years of Java");
    expect(j.salary).toBeUndefined();
  });

  it("writes the pay the system gives as numbers", () => {
    expect(fromRecruitee(B, offer({ salary: { min: 90000, max: 120000, period: "year", currency: "USD" } }))!.salary).toBe("$90,000 – $120,000");
    expect(fromRecruitee(B, offer({ salary: { min: 30, max: 30, period: "hour", currency: "USD" } }))!.salary).toBe("$30 per hour");
    expect(fromRecruitee(B, offer({ salary: { min: 4000, max: 5000, period: "month", currency: "EUR" } }))!.salary).toBe("€4,000 – €5,000 per month");
  });

  it("skips what is not published or has no link", () => {
    expect(fromRecruitee(B, offer({ status: "draft" }))).toBeNull();
    expect(fromRecruitee(B, offer({ careers_url: "" }))).toBeNull();
  });
});

describe("reading a Teamtailor posting", () => {
  const B: Board = { source: "teamtailor", token: "spokeo.na" };
  const item = (over: Record<string, unknown> = {}, posting: Record<string, unknown> = {}) => ({
    id: "4ff07fd5-3ac0-4333-8f4c-955380396321",
    url: "https://spokeo.na.teamtailor.com/jobs/541507-senior-software-developer",
    _jobposting: {
      title: "Senior Software Developer, Web Application",
      description: "<p>Build the web app.</p><ul><li>5+ years of Ruby</li></ul>",
      datePosted: "2026-07-24T09:05:16+02:00",
      hiringOrganization: { name: "Spokeo" },
      jobLocationType: "TELECOMMUTE",
      jobLocation: [{ address: { addressLocality: "Pasadena", addressCountry: "US" } }],
      baseSalary: { currency: "USD", value: { unitText: "YEAR", minValue: "143100", maxValue: "174600" } },
      ...posting,
    },
    ...over,
  });

  it("turns it into a job: the company, the place and the pay come from the posting's own data", () => {
    const j = fromTeamtailor(B, item())!;
    expect(j).toMatchObject({ key: "teamtailor:spokeo.na:4ff07fd5-3ac0-4333-8f4c-955380396321", source: "teamtailor", company: "Spokeo", location: "Pasadena, US", remote: true, country: "US", salary: "$143,100 – $174,600", board: "teamtailor:spokeo.na" });
    expect(j.postedAt).toBe("2026-07-24T07:05:16.000Z");
    expect(j.description).toContain("- 5+ years of Ruby");
  });

  it("writes a single monthly pay, and reads the pay from the text when the posting has no data for it", () => {
    expect(fromTeamtailor(B, item({}, { baseSalary: { currency: "SEK", value: { unitText: "MONTH", value: "28000" } } }))!.salary).toBe("SEK 28,000 per month");
    const noPay = fromTeamtailor(B, item({}, { baseSalary: undefined, description: "<p>The salary range for this role is $90,000 - $120,000 per year.</p>" }))!;
    expect(noPay.salary).toBe("$90,000 – $120,000");
  });

  it("skips what has no posting data or no link", () => {
    expect(fromTeamtailor(B, item({ _jobposting: undefined }))).toBeNull();
    expect(fromTeamtailor(B, item({ url: "" }))).toBeNull();
  });
});
