/** @jest-environment node */
import { interpretAi } from "@/lib/reviewEngine";
import type { ProfileData } from "@/context/profileContext";

const profile = {
  name: "Ana Perez",
  jobTitle: "Accountant",
  contactInfo: { email: "ana@example.com", phone: "5551234567", address: "", city: "Lima", state: "", country: "Peru" },
  careerObjective: "Accountant with five years of experience closing the month and preparing reports for managers, focused on accuracy and clear communication with every team.",
  skills: ["Excel", "SAP", "Budgeting"],
  jobHistory: [{ id: "j1", company: "Acme", title: "Accountant", location: "Lima", startDate: "2019-01", endDate: "", current: true, description: "", accomplishments: ["Closed the books for 12 branches every month."] }],
  education: [{ id: "e1", school: "PUCP", degree: "B.S. Accounting", location: "Lima", startDate: "2014-03", endDate: "2018-12", current: false }],
} as unknown as ProfileData;

const ai = (verdict: string) => ({
  headline: "ok",
  qualitative: ["summaryFit", "skillsFit", "roleRequirements", "experienceFit", "bulletsQuality", "writing"].map((id) => ({ id, verdict, reason: "x" })),
  fixes: [],
});
const ctx = (previous?: object) => ({ template: "classic", fit: { pages: 1, scale: 1 }, previous: previous as never });

it("a judgement never gets worse than in the last review just because the AI phrased it differently", async () => {
  const first = await interpretAi(ai("pass"), profile, ctx());
  const previous = { verdicts: first!.criteria.map((c) => ({ id: c.id, verdict: c.verdict })), applied: [], appliedCriteria: [] };
  const second = await interpretAi(ai("partial"), profile, ctx(previous));
  expect(second!.score).toBeGreaterThanOrEqual(first!.score);
});

it("it can still go up", async () => {
  const first = await interpretAi(ai("partial"), profile, ctx());
  const previous = { verdicts: first!.criteria.map((c) => ({ id: c.id, verdict: c.verdict })), applied: [], appliedCriteria: [] };
  const second = await interpretAi(ai("pass"), profile, ctx(previous));
  expect(second!.score).toBeGreaterThan(first!.score);
});

it("what the person fixed counts as done, even if the AI still says fail", async () => {
  const first = await interpretAi(ai("fail"), profile, ctx());
  const previous = { verdicts: first!.criteria.map((c) => ({ id: c.id, verdict: c.verdict })), applied: ["x"], appliedCriteria: ["summaryFit", "writing"] };
  const second = await interpretAi(ai("fail"), profile, ctx(previous));
  expect(second!.score).toBeGreaterThan(first!.score);
});
