/** @jest-environment node */
import { Country } from "country-state-city";
import { ADZUNA_COUNTRIES, OWN_COUNTRIES, SEARCH_COUNTRIES } from "@/lib/jobCountries";

describe("the countries the job search can be done in", () => {
  it("are the ones of the live board and the ones of our own index, each once, and all real countries", () => {
    expect(SEARCH_COUNTRIES).toEqual(expect.arrayContaining(ADZUNA_COUNTRIES));
    expect(SEARCH_COUNTRIES).toEqual(expect.arrayContaining(OWN_COUNTRIES));
    expect(new Set(SEARCH_COUNTRIES).size).toBe(SEARCH_COUNTRIES.length);
    for (const code of SEARCH_COUNTRIES) {
      expect(code).toMatch(/^[a-z]{2}$/);
      expect(Country.getCountryByCode(code.toUpperCase())).toBeTruthy(); // "uk" and "eu" are not countries: Great Britain is "gb"
    }
  });

  it("include the Spanish-speaking Americas, where Computrabajo reads", () => {
    for (const c of ["pe", "cl", "co", "mx", "ar", "ec", "uy", "cr", "do", "pa", "gt", "bo", "py", "sv", "hn", "ni"]) expect(SEARCH_COUNTRIES).toContain(c);
  });

  it("keep the live board's countries separate: only those are asked of Adzuna", () => {
    expect(ADZUNA_COUNTRIES).not.toContain("pe");
    expect(OWN_COUNTRIES).not.toContain("us");
  });
});
