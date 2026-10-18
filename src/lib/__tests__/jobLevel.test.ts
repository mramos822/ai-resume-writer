import { levelOf } from "@/lib/jobLevel";

const job = (description: string, title = "Full Stack Developer") => ({ title, description, snippet: "" });

describe("years of experience a posting asks for", () => {
  it("reads the plain forms", () => {
    expect(levelOf(job("5+ years of experience with Java")).years).toBe(5);
    expect(levelOf(job("3-5 years of experience")).years).toBe(3);
    expect(levelOf(job("2 years relevant experience")).years).toBe(2);
  });

  it("reads the years even when words sit between 'years' and 'experience'", () => {
    expect(levelOf(job("3+ years of professional full-stack development experience")).years).toBe(3);
    expect(levelOf(job("At least 4 years' hands-on Python and Django development experience")).years).toBe(4);
    expect(levelOf(job("Minimum 5 years in backend engineering experience")).years).toBe(5);
  });

  it("takes the most years the requirements name (a small sub-requirement does not lower it)", () => {
    expect(levelOf(job("5+ years of leadership experience. 3+ years of professional full-stack development experience.")).years).toBe(5);
  });

  it("does not read a sentence that only mentions years", () => {
    expect(levelOf(job("We have grown for 10 years. Experience with React is a plus.")).years).toBe(0);
  });

  it("an entry level job still never asks for more than two years", () => {
    expect(levelOf(job("3+ years of professional full-stack development experience", "Junior Full Stack Developer")).years).toBe(2);
  });
});
