import { getProfileProgress } from "@/lib/profileProgress";
import { isPrivateHost, isSafePublicUrl } from "@/lib/safeUrl";
import type { ProfileData } from "@/context/profileContext";

const empty: ProfileData = {
  name: "",
  jobTitle: "",
  contactInfo: { email: "", phone: "", address: "" },
  careerObjective: "",
  skills: [],
  jobHistory: [],
  education: [],
  internships: [],
  projects: [],
};

describe("getProfileProgress", () => {
  it("is 0% for an empty profile and points at contact info first", () => {
    const p = getProfileProgress(empty);
    expect(p.percent).toBe(0);
    expect(p.doneCount).toBe(0);
    expect(p.next?.key).toBe("contact");
  });

  it("weights sections and reports the next missing one", () => {
    const p = getProfileProgress({
      ...empty,
      contactInfo: { email: "a@b.com", phone: "", address: "" },
      skills: ["a", "b", "c"],
    });
    expect(p.percent).toBe(40); // contact 20 + skills 20
    expect(p.next?.key).toBe("objective");
  });

  it("needs at least three skills to count", () => {
    expect(getProfileProgress({ ...empty, skills: ["a", "b"] }).percent).toBe(0);
  });

  it("is 100% with everything filled and has no next step", () => {
    const p = getProfileProgress({
      ...empty,
      contactInfo: { email: "a@b.com", phone: "1", address: "x" },
      careerObjective: "Build things",
      skills: ["a", "b", "c"],
      jobHistory: [{ id: "1", company: "C", title: "T", description: "", startDate: "", endDate: "", accomplishments: [] }],
      education: [{ id: "1", school: "S", degree: "D", startDate: "", endDate: "" }],
    });
    expect(p.percent).toBe(100);
    expect(p.next).toBeNull();
  });

  it("does not crash on profiles saved before some fields existed", () => {
    const legacy = { name: "Old" } as unknown as ProfileData;
    expect(getProfileProgress(legacy).percent).toBe(0);
  });
});

describe("safeUrl", () => {
  it.each([
    "localhost",
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.5",
    "192.168.1.20",
    "169.254.169.254",
    "[::1]",
    "printer.local",
  ])("treats %s as private", (host) => {
    expect(isPrivateHost(host)).toBe(true);
  });

  it.each(["example.com", "8.8.8.8", "172.32.0.1", "jobs.company.io"])("treats %s as public", (host) => {
    expect(isPrivateHost(host)).toBe(false);
  });

  it("accepts normal job links", () => {
    expect(isSafePublicUrl("https://boards.greenhouse.io/acme/jobs/123")).toBe(true);
  });

  it.each([
    "http://localhost:3000/admin",
    "http://169.254.169.254/latest/meta-data/",
    "file:///etc/passwd",
    "ftp://example.com/x",
    "https://user:pass@example.com/",
    "not a url",
  ])("rejects %s", (url) => {
    expect(isSafePublicUrl(url)).toBe(false);
  });
});
