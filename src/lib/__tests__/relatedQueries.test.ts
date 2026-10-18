import { relatedQueries } from "@/lib/jobSearch";

describe("the titles a search is widened to", () => {
  it("keeps the role first and adds the words the companies use", () => {
    expect(relatedQueries("cybersecurity analyst")).toEqual(expect.arrayContaining(["cybersecurity analyst", "Security Engineer", "Security Analyst"]));
    expect(relatedQueries("QA engineer")).toEqual(expect.arrayContaining(["QA Engineer", "SDET"]));
    expect(relatedQueries("sales representative")[0]).toBe("sales representative");
    expect(relatedQueries("sales representative")).toContain("Account Executive");
    expect(relatedQueries("truck driver")).toContain("Delivery Driver");
  });

  it("searches a role typed in Spanish in English too", () => {
    expect(relatedQueries("contador")).toEqual(expect.arrayContaining(["contador", "Accountant"]));
    expect(relatedQueries("ingeniero de software")).toEqual(expect.arrayContaining(["Software Engineer"]));
    expect(relatedQueries("analista de datos")).toContain("Data Analyst");
    expect(relatedQueries("enfermera")).toEqual(expect.arrayContaining(["Nurse", "Registered Nurse"]));
  });

  it("never asks for more than five titles, without repeats, and drops the seniority", () => {
    const q = relatedQueries("Senior Software Engineer", ["Python"]);
    expect(q.length).toBeLessThanOrEqual(5);
    expect(new Set(q.map((x) => x.toLowerCase())).size).toBe(q.length);
    expect(q).toContain("Software Engineer");
  });
});
