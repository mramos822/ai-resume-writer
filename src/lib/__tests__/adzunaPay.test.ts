/** @jest-environment node */
import { searchJobs, type JobQuery } from "@/lib/jobSearch";

const row = (id: string, over: Record<string, unknown>) => ({ id, title: `Pay test ${id}`, description: "d", redirect_url: `https://x.test/${id}`, created: "2026-10-01", company: { display_name: "Co" }, location: { display_name: "Newark" }, ...over });

const q: JobQuery = { q: "adzuna pay probe", location: "", remoteOnly: false, country: "us" };

// Adzuna fills salary_min / salary_max with its own estimate when the posting names no pay (salary_is_predicted "1"): that is not pay to show.
describe("the pay of an Adzuna job", () => {
  beforeEach(() => {
    process.env.ADZUNA_APP_ID = "id";
    process.env.ADZUNA_APP_KEY = "key";
    jest.spyOn(global, "fetch").mockImplementation(async () => {
      const results = [
        row("a", { salary_min: 139161, salary_max: 139161, salary_is_predicted: "1" }),
        row("b", { salary_min: 90000, salary_max: 120000, salary_is_predicted: "0" }),
        row("c", { salary_min: 70000, salary_max: 70000 }),
        row("d", { title: "Remote Software Engineer ($300/hr)", salary_min: 624000, salary_max: 624000, salary_is_predicted: "0" }),
      ];
      return new Response(JSON.stringify({ results }), { status: 200 });
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
  });

  it("hides the estimated pay and shows the real one with its currency", async () => {
    const r = await searchJobs(q, [], { live: "only", boards: "adzuna" });
    const pay = (id: string) => r.jobs.find((j) => j.key === `adzuna:${id}`)?.salary;
    expect(pay("a")).toBeUndefined();
    expect(pay("b")).toBe("$90,000 – $120,000");
    expect(pay("c")).toBe("$70,000");
    expect(pay("d")).toBe("$300/hr"); // the hourly pay of the title, not the yearly figure made from it
  });
});
