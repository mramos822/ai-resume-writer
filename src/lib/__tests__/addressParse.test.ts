import { normalizeContact } from "@/lib/addressParse";

describe("normalizeContact", () => {
  it("splits a US address with the street and city glued together", () => {
    expect(normalizeContact({ address: "640 Irvington Ave. Hillside, NJ" })).toEqual({
      address: "640 Irvington Ave.", city: "Hillside", state: "New Jersey", country: "United States", countryCode: "US",
    });
  });
  it("reads city, state and zip", () => {
    const r = normalizeContact({ address: "Newark, NJ 07102" });
    expect([r.address, r.city, r.state, r.countryCode]).toEqual(["", "Newark", "New Jersey", "US"]);
  });
  it("reads a full line with a country", () => {
    const r = normalizeContact({ address: "123 Main St, Springfield, IL 62704, USA" });
    expect([r.address, r.city, r.state, r.countryCode]).toEqual(["123 Main St", "Springfield", "Illinois", "US"]);
  });
  it("reads a Peruvian address in Spanish", () => {
    const r = normalizeContact({ address: "Av. Larco 123, Miraflores, Lima, Perú" });
    expect([r.address, r.city, r.state, r.country, r.countryCode]).toEqual(["Av. Larco 123", "Miraflores", "Lima", "Peru", "PE"]);
  });
  it("reads a Canadian province code", () => {
    const r = normalizeContact({ address: "Toronto, ON, Canada" });
    expect([r.city, r.state, r.countryCode]).toEqual(["Toronto", "Ontario", "CA"]);
  });
  it("completes what the AI gave in parts", () => {
    const r = normalizeContact({ address: "12 Oak Rd", city: "Austin", state: "TX", country: "USA" });
    expect([r.address, r.city, r.state, r.country, r.countryCode]).toEqual(["12 Oak Rd", "Austin", "Texas", "United States", "US"]);
  });
  it("leaves an empty address empty", () => {
    expect(normalizeContact({})).toEqual({ address: "", city: "", state: "", country: "", countryCode: "" });
  });
});
