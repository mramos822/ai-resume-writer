import { targetRoleOf } from "@/lib/roleProfile";
import type { ProfileData } from "@/context/profileContext";

const base = {
  jobHistory: [{ id: "j", company: "Restaurant", title: "Waiter", startDate: "2023-01", endDate: "2023-12", current: false, accomplishments: [] }],
} as unknown as ProfileData;

describe("the role a resume is judged against", () => {
  it("uses the job title the person wrote", () => {
    expect(targetRoleOf({ ...base, jobTitle: "Junior Developer" } as ProfileData)).toBe("Junior Developer");
  });
  it("a student with a side job is not aiming for that job", () => {
    const p = { ...base, education: [{ id: "e", school: "UNAL", degree: "Hochschulstudium: Systemtechnik", startDate: "2022-01", endDate: "", current: true }] } as unknown as ProfileData;
    expect(targetRoleOf(p)).toBe("Systemtechnik student");
    const p2 = { ...base, education: [{ id: "e", school: "UNAL", degree: "B.S. Systems Engineering", startDate: "2022-01", endDate: "", current: true }] } as unknown as ProfileData;
    expect(targetRoleOf(p2)).toBe("Systems Engineering student");
  });
  it("without studies in progress it is the most recent job", () => {
    expect(targetRoleOf(base)).toBe("Waiter");
  });
});
