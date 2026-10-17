import { fromShouting, isShouting } from "@/lib/nameCase";

describe("fromShouting", () => {
  it("writes a name in capitals as a name", () => {
    expect(fromShouting("TAYLOR COOK")).toBe("Taylor Cook");
    expect(fromShouting("MARIANA O'BRIEN-SMITH")).toBe("Mariana O'Brien-Smith");
    expect(fromShouting("JUAN DE LA CRUZ")).toBe("Juan de la Cruz");
    expect(fromShouting("SOFTWARE ENGINEER")).toBe("Software Engineer");
  });

  it("leaves everything else exactly as the person wrote it", () => {
    for (const s of ["Taylor Cook", "taylor cook", "McDonald", "iPhone Developer", "AI", "IT", "", "A", "CEO"]) expect(fromShouting(s)).toBe(s);
  });

  it("only shouting counts: it needs letters and no lower case", () => {
    expect(isShouting("ABCDE")).toBe(true);
    expect(isShouting("TAYLOR COOK")).toBe(true);
    expect(isShouting("ABC")).toBe(false); // a lone short word is an acronym
    expect(isShouting("ABc")).toBe(false);
    expect(isShouting("123")).toBe(false);
    expect(isShouting("AB")).toBe(false); // too short to be sure: it may be an acronym
  });
});
