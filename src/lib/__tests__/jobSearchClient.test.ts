import { jobSearchParams, withPhase } from "@/lib/jobSearchClient";

describe("how the screens ask the job search", () => {
  const ask = { q: " Software Engineer ", place: "Hillside, New Jersey", country: "US", skills: ["JavaScript", "TypeScript", "React", "Git"], lang: "en" };

  it("asks for a wide search with the person's role, place, country, language and first three skills", () => {
    const p = jobSearchParams(ask);
    expect(Object.fromEntries(p)).toEqual({ q: "Software Engineer", location: "Hillside, New Jersey", country: "US", wide: "1", lang: "en", skills: "JavaScript,TypeScript,React" });
  });

  it("the dashboard and the job search page ask EXACTLY the same, so the second one gets the answer the first one made the server remember", () => {
    const fromDashboard = jobSearchParams({ q: "Software Engineer", place: "Hillside, New Jersey", country: "US", skills: ["JavaScript", "TypeScript", "React", "Git", "Go"], lang: "en" });
    const fromPage = jobSearchParams({ ...ask, remote: false, allLanguages: false });
    expect(fromPage.toString()).toBe(fromDashboard.toString());
  });

  it("a search for remote work has no place, and says the language when the person chose every language", () => {
    const p = jobSearchParams({ ...ask, remote: true, allLanguages: true });
    expect(p.get("location")).toBe("");
    expect(p.get("remote")).toBe("1");
    expect(p.get("lang")).toBe("all");
  });

  it("leaves out the skills when there are none, and adds the part of the search that is asked", () => {
    expect(jobSearchParams({ ...ask, skills: [] }).has("skills")).toBe(false);
    const own = withPhase(jobSearchParams(ask), "own");
    expect(own.get("phase")).toBe("own");
    expect(own.get("q")).toBe("Software Engineer");
    expect(withPhase(jobSearchParams(ask), "adzuna").get("phase")).toBe("adzuna");
  });
});
