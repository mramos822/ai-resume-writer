import { formatContactPhone, formatPhoneInput } from "@/lib/phone";
import { displayUrl, labeledLink, shortContactLink } from "@/lib/links";

describe("phone numbers keep the grouping of their country", () => {
  it("prints national numbers with their country's own look", () => {
    expect(formatContactPhone("987654321", "PE")).toBe("+51 987 654 321");
    expect(formatContactPhone("612345678", "ES")).toBe("+34 612 34 56 78");
    expect(formatContactPhone("5512345678", "MX")).toMatch(/^\+52 55 1234 5678$/);
    expect(formatContactPhone("7911123456", "GB")).toBe("+44 7911 123456");
  });
  it("keeps the US look for US numbers", () => {
    expect(formatContactPhone("7863665315", "US")).toBe("(786) 366-5315");
  });
  it("groups an international number of another country, whatever the country of the person", () => {
    expect(formatContactPhone("+51987654321", "PE")).toBe("+51 987 654 321");
    expect(formatContactPhone("+51987654321", "US")).toBe("+51 987 654 321");
  });
  it("groups a full international number while typing", () => {
    expect(formatPhoneInput("+51987654321", "PE")).toBe("+51 987 654 321");
  });
});

describe("LinkedIn address", () => {
  const url = "https://www.linkedin.com/in/sam-lee/";
  it("is short only next to its logo or name", () => {
    expect(shortContactLink(url)).toBe("in/sam-lee");
    expect(labeledLink("LinkedIn", url)).toBe("in/sam-lee");
  });
  it("is complete anywhere else", () => {
    expect(displayUrl(url)).toBe("linkedin.com/in/sam-lee");
    expect(labeledLink("Portfolio", url)).toBe("linkedin.com/in/sam-lee");
    expect(labeledLink("", url)).toBe("linkedin.com/in/sam-lee");
  });
});
