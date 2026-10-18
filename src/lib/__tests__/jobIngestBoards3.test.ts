/** @jest-environment node */
import { fetchBoard, fromGetOnBoard, fromJobicy, fromRemoteOk, fromUsaJobs, GETONBOARD_COUNTRIES } from "@/lib/ingest/ats";
import type { Board } from "@/lib/ingest/boards";

// the shapes below are the ones these three boards really answer (public, no key)
const GOB: Board = { source: "getonboard", token: "all", name: "Get on Board" };
const gob = (over: Record<string, unknown> = {}, id = "semi-senior-java-developer-etl-23people-remote-ebb4") => ({
  id,
  type: "job",
  links: { public_url: `https://www.getonbrd.com/jobs/${id}` },
  attributes: {
    title: "Semi Senior Java Developer / ETL",
    description_headline: "Skills Excluyentes",
    description: "<ul><li>Experiencia excluyente trabajando con Java.</li></ul>",
    functions_headline: "Funciones del cargo",
    functions: "<p>Automatizar procesos de datos.</p>",
    desirable_headline: "Skills Deseables",
    desirable: "<ul><li>Conocimientos en Python.</li></ul>",
    benefits_headline: "Beneficios",
    benefits: "<ul><li>Seguro complementario</li></ul>",
    remote: true,
    countries: ["Chile", "Colombia"],
    category_name: "Data Science / Analytics",
    min_salary: 2000,
    max_salary: 2200,
    published_at: 1792153896,
    company: { data: { id: "23people-cl", type: "company", attributes: { name: "23people", logo: "https://cdn.getonbrd.com/logo.png" } } },
    seniority: { data: { attributes: { name: "Semi Senior" } } },
    modality: { data: { attributes: { name: "Full time" } } },
    location_cities: { data: [] },
    tags: { data: [{ attributes: { name: "Java" } }, { attributes: { name: "ETL" } }] },
    ...over,
  },
});

describe("reading a Get on Board job", () => {
  it("turns it into a job: the company, the pay in dollars a month, the countries a remote job is open to, the skills", () => {
    const j = fromGetOnBoard(GOB, gob() as never)!;
    expect(j).toMatchObject({
      key: "getonboard:semi-senior-java-developer-etl-23people-remote-ebb4",
      source: "getonboard",
      title: "Semi Senior Java Developer / ETL",
      company: "23people",
      location: "Remote, Chile, Colombia",
      remote: true,
      salary: "$2,000 – $2,200 per month",
      board: "getonboard:all",
      tags: ["Data Science / Analytics", "Semi Senior", "Full time", "Java", "ETL"],
    });
    expect(j.url).toBe("https://www.getonbrd.com/jobs/semi-senior-java-developer-etl-23people-remote-ebb4");
    expect(j.country).toBeUndefined(); // two countries: open to a region
    expect(j.postedAt).toBe("2026-10-16T12:31:36.000Z");
    expect(j.description).toContain("Funciones del cargo");
    expect(j.description).toContain("- Experiencia excluyente trabajando con Java.");
    expect(j.description).not.toContain("<");
  });

  it("is in the country when it names one, and in its cities when it is not remote", () => {
    expect(fromGetOnBoard(GOB, gob({ remote: true, countries: ["Chile"] }) as never)!.country).toBe("CL");
    const office = fromGetOnBoard(GOB, gob({ remote: false, countries: ["Peru"], location_cities: { data: [{ attributes: { name: "Lima" } }] } }) as never)!;
    expect(office).toMatchObject({ location: "Lima, Peru", remote: false, country: "PE" });
    expect(fromGetOnBoard(GOB, gob({ remote: true, countries: ["Remote"] }) as never)!).toMatchObject({ location: "Remote", country: undefined });
  });

  it("has no pay when the company gives none, and skips what has no link or title", () => {
    expect(fromGetOnBoard(GOB, gob({ min_salary: null, max_salary: null }) as never)!.salary).toBeUndefined();
    expect(fromGetOnBoard(GOB, { ...gob(), links: {} } as never)).toBeNull();
    expect(fromGetOnBoard(GOB, gob({ title: "" }) as never)).toBeNull();
  });
});

describe("reading a Remote OK job", () => {
  const B: Board = { source: "remoteok", token: "all", name: "Remote OK" };
  const row = (over: Record<string, unknown> = {}) => ({ id: "1130001", epoch: 1792350000, company: "Acme", position: "Senior Backend Engineer", tags: ["python", "aws"], description: "<p>Build things in Python.</p><ul><li>5+ years</li></ul>", location: "Worldwide", salary_min: 120000, salary_max: 160000, url: "https://remoteok.com/remote-jobs/remote-senior-backend-engineer-acme-1130001", apply_url: "https://remoteOK.com/l/1130001", company_logo: "https://remoteok.com/logo.png", ...over });

  it("turns it into a job that links to Remote OK's own page (its terms), with the pay in dollars a year", () => {
    const j = fromRemoteOk(B, row())!;
    expect(j).toMatchObject({ key: "remoteok:1130001", source: "remoteok", title: "Senior Backend Engineer", company: "Acme", remote: true, salary: "$120,000 – $160,000", board: "remoteok:all", tags: ["python", "aws"] });
    expect(j.url).toBe("https://remoteok.com/remote-jobs/remote-senior-backend-engineer-acme-1130001");
    expect(j.description).toContain("- 5+ years");
  });

  it("accepts the address as Remote OK writes it, with capitals (remoteOK.com)", () => {
    expect(fromRemoteOk(B, row({ url: "https://remoteOK.com/remote-jobs/remote-graduate-transport-planner-curtins-1137542" }))?.key).toBe("remoteok:1130001");
  });

  it("skips the row of terms that opens the feed, and a link that is not Remote OK's", () => {
    expect(fromRemoteOk(B, { legal: "API Terms of Service: please link back" } as never)).toBeNull();
    expect(fromRemoteOk(B, row({ url: "https://evil.example/job/1" }))).toBeNull();
  });
});

describe("reading a Jobicy job", () => {
  const B: Board = { source: "jobicy", token: "all", name: "Jobicy" };
  const row = (over: Record<string, unknown> = {}) => ({ id: 142001, url: "https://jobicy.com/jobs/142001-data-analyst", jobTitle: "Data Analyst", companyName: "Beta &amp; Co", jobIndustry: ["Data Science"], jobType: ["Full-Time"], jobGeo: "Europe", jobLevel: "Midweight", jobDescription: "<p>Analyze data.</p>", pubDate: "2026-10-15 10:00:00", salaryMin: 50000, salaryMax: 70000, salaryCurrency: "EUR", salaryPeriod: "yearly", ...over });

  it("turns it into a remote job that links to Jobicy's page, with the pay in its own money", () => {
    const j = fromJobicy(B, row())!;
    expect(j).toMatchObject({ key: "jobicy:142001", source: "jobicy", title: "Data Analyst", company: "Beta & Co", location: "Remote – Europe", remote: true, salary: "€50,000 – €70,000", tags: ["Data Science", "Full-Time", "Midweight"] });
    expect(j.url).toBe("https://jobicy.com/jobs/142001-data-analyst");
    expect(fromJobicy(B, row({ jobGeo: "Anywhere" }))!.location).toBe("Remote – anywhere");
  });

  it("skips what is not Jobicy's own link", () => {
    expect(fromJobicy(B, row({ url: "https://example.com/x" }))).toBeNull();
  });
});

describe("reading the whole board of Get on Board", () => {
  afterEach(() => jest.restoreAllMocks());

  it("reads the remote jobs and each country, page by page as far as the board says, each job once, asking for the company and the skills", async () => {
    const asked: string[] = [];
    jest.spyOn(global, "fetch").mockImplementation(async (u) => {
      asked.push(String(u));
      const page = Number(/[?&]page=(\d+)/.exec(String(u))?.[1] ?? 1);
      return new Response(JSON.stringify({ data: [gob({}, `job-${page}-a`), gob({}, `job-${page}-b`)], meta: { page, per_page: 50, total_pages: 3 } }), { status: 200 });
    });
    const jobs = await fetchBoard(GOB);
    expect(jobs).toHaveLength(6); // the same six jobs came in every list: each is kept once
    expect(asked).toHaveLength(3 * (1 + GETONBOARD_COUNTRIES.length));
    expect(asked[0]).toContain("remote=true");
    expect(asked.some((u) => u.includes("country_code=CL"))).toBe(true);
    expect(asked.every((u) => u.includes("per_page=100"))).toBe(true);
    expect(decodeURIComponent(asked[0])).toContain('["company","seniority","modality","location_cities","tags"]');
    expect(asked.every((u) => u.startsWith("https://www.getonbrd.com/api/v0/search/jobs?"))).toBe(true);
  });

  it("stops by itself on an empty page, and reports a board that answers with an error", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async () => new Response(JSON.stringify({ data: [], meta: { total_pages: 9 } }), { status: 200 }));
    expect(await fetchBoard(GOB)).toEqual([]);
    jest.spyOn(global, "fetch").mockImplementation(async () => new Response("", { status: 500 }));
    await expect(fetchBoard(GOB)).rejects.toThrow(/getonboard: 500/);
  });
});

describe("reading a USAJOBS job", () => {
  const B: Board = { source: "usajobs", token: "all", name: "USAJOBS" };
  const item = (over: Record<string, unknown> = {}) => ({
    MatchedObjectId: "883691200",
    MatchedObjectDescriptor: {
      PositionTitle: "AI Software Engineer ",
      PositionURI: "https://www.usajobs.gov:443/job/883691200",
      PositionLocationDisplay: "2 Locations",
      PositionLocation: [{ LocationName: "San Francisco, California" }, { LocationName: "Lakewood, Colorado" }, { LocationName: "Austin, Texas" }],
      OrganizationName: "Technology Transformation Service",
      DepartmentName: "General Services Administration",
      JobCategory: [{ Name: "Information Technology Management" }],
      QualificationSummary: "You must have one year of specialized experience at the GS-12 level.",
      PositionRemuneration: [{ MinimumRange: "117284", MaximumRange: "172980", RateIntervalCode: "PA", Description: "Per Year" }],
      PublicationStartDate: "2026-09-04T00:00:00.0000",
      ApplicationCloseDate: "2099-12-31T23:59:59.9970",
      UserArea: { Details: { JobSummary: "You will set the technical strategy for AI-enabled systems.", MajorDuties: ["Directs engineering strategy", "Leads a team of engineers"], Requirements: "You must be a U.S. citizen.", TeleworkEligible: true, RemoteIndicator: false, LowGrade: "13", HighGrade: "13" } },
      ...over,
    },
  });

  it("turns it into a job: the agency, the places, the pay a year, the grade, the sections, the clean address", () => {
    const j = fromUsaJobs(B, item() as never)!;
    expect(j).toMatchObject({
      key: "usajobs:883691200",
      source: "usajobs",
      title: "AI Software Engineer",
      company: "Technology Transformation Service",
      location: "San Francisco, California; Lakewood, Colorado and 1 more",
      remote: false,
      country: "US",
      salary: "$117,284 – $172,980",
      board: "usajobs:all",
      url: "https://www.usajobs.gov/job/883691200",
      tags: ["General Services Administration", "Information Technology Management", "GS-13", "Telework eligible"],
    });
    expect(j.postedAt).toBe("2026-09-04T00:00:00.000Z");
    expect(j.description).toContain("Directs engineering strategy");
    expect(j.description).toContain("Qualifications");
  });

  it("is left out when its closing date has passed, or it has no title or an address that is not USAJOBS's", () => {
    expect(fromUsaJobs(B, item({ ApplicationCloseDate: "2020-01-01T00:00:00.0000" }) as never)).toBeNull();
    expect(fromUsaJobs(B, item({ PositionTitle: "" }) as never)).toBeNull();
    expect(fromUsaJobs(B, item({ PositionURI: "https://evil.example/job/1" }) as never)).toBeNull();
  });

  it("is read with the key and the email in the headers only, and nothing without them", async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    process.env.USAJOBS_API_KEY = "secret-key";
    process.env.USAJOBS_EMAIL = "me@example.com";
    jest.spyOn(global, "fetch").mockImplementation(async (u, init) => {
      seen.push({ url: String(u), headers: (init?.headers ?? {}) as Record<string, string> });
      return new Response(JSON.stringify({ SearchResult: { SearchResultItems: [item()], SearchResultCountAll: 1 } }), { status: 200 });
    });
    const jobs = await fetchBoard(B);
    expect(jobs).toHaveLength(1);
    expect(seen[0].headers).toMatchObject({ "Authorization-Key": "secret-key", "User-Agent": "me@example.com" });
    expect(seen[0].url).not.toContain("secret-key"); // the key is never in an address
    delete process.env.USAJOBS_API_KEY;
    await expect(fetchBoard(B)).rejects.toThrow(/not set/);
    jest.restoreAllMocks();
  });
});

describe("the dates of USAJOBS", () => {
  const B: Board = { source: "usajobs", token: "all", name: "USAJOBS" };
  const base = { MatchedObjectId: "1", MatchedObjectDescriptor: { PositionTitle: "Analyst", PositionURI: "https://www.usajobs.gov/job/1", OrganizationName: "Agency", ApplicationCloseDate: "2099-01-01T00:00:00.0000" } };
  it("are read as UTC when they carry no zone, and as written when they do", () => {
    expect(fromUsaJobs(B, { ...base, MatchedObjectDescriptor: { ...base.MatchedObjectDescriptor, PublicationStartDate: "2026-09-04T00:00:00.0000" } } as never)!.postedAt).toBe("2026-09-04T00:00:00.000Z");
    expect(fromUsaJobs(B, { ...base, MatchedObjectDescriptor: { ...base.MatchedObjectDescriptor, PublicationStartDate: "2026-09-04T00:00:00+05:00" } } as never)!.postedAt).toBe("2026-09-03T19:00:00.000Z");
  });
});
