import { isGenericName, mergeProfileData, sameName } from "@/lib/profileMatch";

describe("sameName", () => {
  it("matches the same name written differently", () => {
    expect(sameName("Mariano Ramos", "mariano ramos")).toBe(true);
    expect(sameName("Mariano Ramos", "Ramos, Mariano")).toBe(true);
    expect(sameName("Mariano Ramos", "Mariano José Ramos Pérez")).toBe(true);
    expect(sameName("María Pérez", "Maria Perez")).toBe(true);
    expect(sameName("Mariano Ramos", "Mariano Ramoz")).toBe(true);
  });
  it("does not match different people or names that say nothing", () => {
    expect(sameName("Mariano Ramos", "Mariana Torres")).toBe(false);
    expect(sameName("Mariano", "Mariano Ramos")).toBe(false);
    expect(sameName("John Doe", "John Doe")).toBe(false);
    expect(sameName("Profile 2", "Mariano Ramos")).toBe(false);
    expect(isGenericName("")).toBe(true);
  });
});

describe("mergeProfileData", () => {
  it("keeps what the new resume has and what only the old profile had", () => {
    const prev = { name: "Sam", photo: "data:img", jobTitle: "Old", skills: ["a"], contactInfo: { email: "a@a.com", phone: "1" } };
    const next = { name: "Sam Lee", jobTitle: "New", skills: [], contactInfo: { email: "", phone: "2" } };
    expect(mergeProfileData(prev, next)).toEqual({
      name: "Sam Lee",
      photo: "data:img",
      jobTitle: "New",
      skills: ["a"],
      contactInfo: { email: "a@a.com", phone: "2" },
    });
  });
});
