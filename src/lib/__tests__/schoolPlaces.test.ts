import { placeOfSchool, countryOfSchool, schoolsOf, allSchools } from "@/lib/worldSchools";
import { US_SCHOOLS } from "@/lib/schools";

describe("placeOfSchool", () => {
  it("knows where a school is, whatever the punctuation or case", () => {
    expect(placeOfSchool("New Jersey Institute of Technology")).toBe("Newark, NJ");
    expect(placeOfSchool("new jersey institute of technology")).toBe("Newark, NJ");
    expect(placeOfSchool("Texas A&M University")).toBe("College Station, TX");
  });
  it("is empty for a school it does not know", () => {
    expect(placeOfSchool("Escuela Rara del Sur")).toBe("");
  });
  it("covers the schools of the suggestions with one main campus", () => {
    // multi-campus systems and online schools have no single place on purpose
    const left = new Set(["Dallas College", "Maricopa Community College", "City Colleges of Chicago", "Arizona State University Online", "Purdue Global", "Excelsior University"]);
    const missing = Array.from(new Set(US_SCHOOLS)).filter((s) => !left.has(s) && !placeOfSchool(s));
    expect(missing).toEqual([]);
  });
  it("has the main universities of other countries, with their place and country", () => {
    expect(schoolsOf("PE")).toContain("Pontificia Universidad Católica del Perú");
    expect(placeOfSchool("Universidad Nacional de Ingeniería")).toBe("Lima, Peru");
    expect(placeOfSchool("University of Oxford")).toBe("Oxford, United Kingdom");
    expect(countryOfSchool("Tecnológico de Monterrey")).toBe("MX");
    expect(countryOfSchool("Harvard University")).toBe("US");
    expect(schoolsOf("ZZ")).toEqual([]);
    expect(allSchools().length).toBeGreaterThan(600);
  });
});

describe("searching without accents", () => {
  it("finds a school whatever the accents or capitals", () => {
    expect(placeOfSchool("pontificia universidad catolica del peru")).toBe("Lima, Peru");
    expect(placeOfSchool("UNIVERSIDAD DE PIURA")).toBe("Piura, Peru");
    expect(placeOfSchool("Sorbonne Universite")).toBe("Paris, France");
  });
});
