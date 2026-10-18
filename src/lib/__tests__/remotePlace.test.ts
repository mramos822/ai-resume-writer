import { isRemotePlace, remoteCountryFit, REMOTE_PLACE } from "@/lib/remotePlace";

describe("Remote as a place", () => {
  it("is recognised in English and Spanish, with spaces and any case", () => {
    expect(isRemotePlace(REMOTE_PLACE)).toBe(true);
    expect(isRemotePlace("  remoto ")).toBe(true);
    expect(isRemotePlace("REMOTE")).toBe(true);
  });

  it("is not a city that merely contains the word", () => {
    expect(isRemotePlace("Remote Springs")).toBe(false);
    expect(isRemotePlace("")).toBe(false);
    expect(isRemotePlace("Palo Alto")).toBe(false);
  });
});

describe("how a remote job fits the country of the search", () => {
  it("0 when the job names the country (by name, code or common alias)", () => {
    expect(remoteCountryFit({ location: "USA Only" }, "US")).toBe(0);
    expect(remoteCountryFit({ location: "United States, Canada" }, "us")).toBe(0);
    expect(remoteCountryFit({ location: "UK" }, "GB")).toBe(0);
    expect(remoteCountryFit({ location: "Germany" }, "DE")).toBe(0);
  });

  it("1 when it can be done from anywhere or does not say", () => {
    expect(remoteCountryFit({ location: "Worldwide" }, "US")).toBe(1);
    expect(remoteCountryFit({ location: "Anywhere" }, "PE")).toBe(1);
    expect(remoteCountryFit({ location: "" }, "US")).toBe(1);
    expect(remoteCountryFit({ location: "Remote" }, "US")).toBe(1);
  });

  it("2 when it is for another country or region", () => {
    expect(remoteCountryFit({ location: "Europe" }, "US")).toBe(2);
    expect(remoteCountryFit({ location: "Germany only" }, "US")).toBe(2);
    expect(remoteCountryFit({ location: "India" }, "US")).toBe(2);
  });

  it("does not take a short code for part of another word", () => {
    expect(remoteCountryFit({ location: "Business hours, Australia" }, "US")).toBe(2);
  });

  it("counts a job of a source that already searched by the country as 0", () => {
    expect(remoteCountryFit({ location: "Dallas, TX", local: true }, "US")).toBe(0);
  });
});
