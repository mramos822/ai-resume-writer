import { seniorityOf } from "@/lib/reviewRubric";
import type { ProfileData } from "@/context/profileContext";

const job = (id: string, startDate: string, endDate: string, over: object = {}) => ({ id, title: "Dev", company: `Co ${id}`, startDate, endDate, current: false, description: "", accomplishments: [], ...over });
const profile = (jobs: object[]) => ({ name: "A", jobHistory: jobs, education: [], skills: [], languages: [] }) as unknown as ProfileData;

describe("seniorityOf counts the time actually worked", () => {
  it("does not add up jobs that happened at the same time", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => job(String(i), "2015-12", "2019-05"));
    expect(seniorityOf(profile(jobs)).years).toBeCloseTo(3.4, 1);
    expect(seniorityOf(profile(jobs)).level).toBe("mid-level");
  });

  it("adds jobs that follow each other", () => {
    expect(seniorityOf(profile([job("1", "2018-01", "2019-01"), job("2", "2019-01", "2021-01")])).years).toBeCloseTo(3, 1);
  });

  it("does not count the gap between two jobs", () => {
    expect(seniorityOf(profile([job("1", "2010-01", "2011-01"), job("2", "2020-01", "2021-01")])).years).toBeCloseTo(2, 1);
  });

  it("counts a part-time job that sits inside a longer one once", () => {
    expect(seniorityOf(profile([job("1", "2018-01", "2022-01"), job("2", "2019-06", "2020-06")])).years).toBeCloseTo(4, 1);
  });

  it("is zero without dates, and a job still going counts until now", () => {
    expect(seniorityOf(profile([job("1", "", "")])).years).toBe(0);
    expect(seniorityOf(profile([job("1", "2024-01", "", { current: true })])).years).toBeGreaterThan(2);
  });
});
