import { schoolTerms } from "@/lib/schoolTerms";

describe("schoolTerms", () => {
  it("builds the initials of a school", () => {
    expect(schoolTerms("New Jersey Institute of Technology")).toContain("NJIT");
    expect(schoolTerms("Pontificia Universidad Católica del Perú")).toContain("PUCP");
    expect(schoolTerms("Universidad Nacional Mayor de San Marcos")).toContain("UNMSM");
    expect(schoolTerms("University of California, Los Angeles")).toContain("UCLA");
  });
  it("adds what is in parentheses and the common nicknames", () => {
    expect(schoolTerms("Universidad Nacional Autónoma de México (UNAM)")).toContain("UNAM");
    expect(schoolTerms("Georgia Institute of Technology")).toContain("Georgia Tech");
    expect(schoolTerms("Massachusetts Institute of Technology")).toContain("MIT");
  });
});
