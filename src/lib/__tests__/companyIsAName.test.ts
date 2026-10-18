import { cleanParsedProfile, nameFromWebAddress } from "@/lib/parseCleanup";
import type { ProfileData } from "@/context/profileContext";

describe("the company of a job is a name, never a link", () => {
  it("turns a web address into the name, as the resume writes it elsewhere in the job", () => {
    expect(nameFromWebAddress("mygeochallenge.com", ["Founder", "Built myGeoChallenge from scratch"])).toBe("myGeoChallenge");
    expect(nameFromWebAddress("https://www.acme.io/jobs", ["Engineer"])).toBe("Acme");
    expect(nameFromWebAddress("www.my-shop.co.uk", [])).toBe("My-shop");
  });

  it("leaves a real name alone, even one with a dot or a number", () => {
    for (const name of ["myGeoChallenge", "Starbucks Inc.", "Uber", "Acme Corp.", "3M", "Node.js Consulting", "Self-employed"]) {
      expect(nameFromWebAddress(name, [])).toBe(name);
    }
  });

  it("is applied to every job read from a resume", () => {
    const out = cleanParsedProfile({
      jobHistory: [{ id: "1", title: "Founder", company: "mygeochallenge.com", location: "", description: "", startDate: "", endDate: "", accomplishments: ["Launched myGeoChallenge"] }],
    } as unknown as Partial<ProfileData>);
    expect(out.jobHistory?.[0].company).toBe("myGeoChallenge");
  });
});
