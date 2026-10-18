import { dedupeProfile } from "@/lib/profileDedupe";
import type { ProfileData } from "@/context/profileContext";

const job = (id: string, company: string, over: object = {}) => ({ id, title: "Nurse", company, startDate: "2020-01", endDate: "", current: true, description: "", accomplishments: ["Cared for patients"], ...over });
const profile = (jobs: object[]) => ({ name: "A", jobHistory: jobs, education: [], skills: [], languages: [] }) as unknown as ProfileData;

describe("dedupeProfile keeps different employers apart", () => {
  it("does not merge two jobs with the same title and start month at different companies", () => {
    const out = dedupeProfile(profile([job("1", "St. Mary Hospital"), job("2", "City Clinic")]));
    expect(out.removed).toBe(0);
  });

  it("does not merge numbered companies either", () => {
    const out = dedupeProfile(profile([job("1", "Company 1"), job("2", "Company 2"), job("3", "Company 3")]));
    expect(out.removed).toBe(0);
  });

  it("still merges the same job written a little differently", () => {
    expect(dedupeProfile(profile([job("1", "Acme Corp"), job("2", "Acme Corporation")])).removed).toBe(1);
    expect(dedupeProfile(profile([job("1", "Google"), job("2", "Google LLC")])).removed).toBe(1);
  });

  it("still merges an exact repeat", () => {
    expect(dedupeProfile(profile([job("1", "City Clinic"), job("2", "City Clinic")])).removed).toBe(1);
  });
});
