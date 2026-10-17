/**
 * @jest-environment node
 */
import { evaluateAuto } from "@/lib/reviewRubric";
import { applyFixes, basicReview, patchChangesProfile, snapshotFor, twoPagesAlt } from "@/lib/resumeReview";
import { layoutFacts, lookFamily } from "@/lib/layoutFacts";
import { passesPage } from "@/lib/pageRules";
import { reviewPayload, reviewSystemPrompt } from "@/lib/reviewEngine";
import type { ProfileData } from "@/context/profileContext";

const profile = (extra: Partial<ProfileData> = {}): ProfileData =>
  ({
    name: "Taylor Cook",
    jobTitle: "Software Engineer",
    contactInfo: { email: "t@example.com", phone: "(315) 802-8179", address: "Palo Alto, CA" },
    careerObjective: "Innovative programmer who likes building useful things.",
    skills: ["Scripting", "SQL"],
    jobHistory: [],
    education: [],
    internships: [],
    projects: [],
    ...extra,
  }) as unknown as ProfileData;

const onePage = (fit: Parameters<typeof evaluateAuto>[1]) => evaluateAuto(profile(), fit).find((c) => c.id === "onePage")!;

describe("the length guideline follows what the person chose", () => {
  it("two pages at a comfortable size is not 'crowded'", () => {
    const r = onePage({ pages: 2, scale: 1, maxPages: 2, lastFill: 0.6 });
    expect(r.verdict).toBe("pass");
    expect(r.reason).toMatch(/two pages/i);
    expect(passesPage({ pages: 2, scale: 1, maxPages: 2 })).toBe(true);
  });

  it("the same two pages are too long when the person asked for one", () => {
    expect(onePage({ pages: 2, scale: 1, maxPages: 1 }).verdict).toBe("fail");
    expect(passesPage({ pages: 2, scale: 1 })).toBe(false);
  });

  it("a second page with a few lines is flagged, because it is better tightened to one", () => {
    const r = onePage({ pages: 2, scale: 1, maxPages: 2, lastFill: 0.08 });
    expect(r.verdict).toBe("partial");
    expect(r.reason).toMatch(/second page has only a few lines/i);
  });

  it("when two pages do not hold it either, it says so", () => {
    const r = onePage({ pages: 3, scale: 0.5, maxPages: 2 });
    expect(r.verdict).toBe("fail");
    expect(r.reason).toMatch(/two pages/i);
  });
});

describe("keeping everything on two pages is offered, and applied", () => {
  it("is offered for a too-long resume in a look that can do two pages and when one page was chosen", () => {
    expect(twoPagesAlt("onePage", profile(), "classic")).toEqual({ type: "twoPages" });
    expect(twoPagesAlt("onePage", profile(), "modern")).toBeNull(); // that look is always one page
    expect(twoPagesAlt("onePage", profile({ pageGoal: "two" }), "classic")).toBeNull(); // already two
    expect(twoPagesAlt("numbers", profile(), "classic")).toBeNull(); // only for the length guideline
  });

  it("the review lists it next to the cut", () => {
    const longProfile = profile({ jobHistory: [] });
    const review = basicReview(longProfile, { pages: 1, scale: 0.5, maxPages: 1 }, "classic", null);
    const issue = review.issues.find((i) => i.criterionId === "onePage");
    expect(issue?.alt).toEqual({ type: "twoPages" });
  });

  it("applying it only changes the page goal, and can be undone", () => {
    const p = profile();
    const patch = applyFixes(p, [{ type: "twoPages" }]);
    expect(patch).toEqual({ pageGoal: "two" });
    expect(patchChangesProfile(p, patch)).toBe(true);
    expect(patchChangesProfile(profile({ pageGoal: "two" }), patch)).toBe(false);
    expect(snapshotFor(p, patch)).toEqual({ pageGoal: "one" });
  });
});

describe("the AI is told about the look, the length and the role", () => {
  it("knows which looks are ATS-safe", () => {
    expect(lookFamily("ats")).toBe("ats-safe");
    expect(lookFamily("classic")).toBe("ats-safe");
    expect(lookFamily("executive")).toBe("one-column");
    expect(lookFamily("modern")).toBe("two-column");
    expect(lookFamily("rirekisho")).toBe("form");
  });

  it("describes what the person chose and what came out", () => {
    const f = layoutFacts(profile({ pageGoal: "any", photo: "data:image/png;base64,AAAA" }), "executive", { pages: 2, scale: 1, maxPages: 2, lastFill: 0.5 });
    expect(f).toMatchObject({ family: "one-column", hasPhoto: true, lengthChoice: "kaizo", pagesAllowed: 2, pagesNow: 2, canUseTwoPages: true, lastPageFill: 0.5 });
  });

  it("puts the facts in the review payload and the rules in the prompt", () => {
    const payload = reviewPayload(profile({ pageGoal: "two" }), { template: "classic", fit: { pages: 2, scale: 1, maxPages: 2 } }, []);
    expect(payload.layout).toMatchObject({ look: "classic", lengthChoice: "two", pagesAllowed: 2, pagesNow: 2 });
    const system = reviewSystemPrompt();
    expect(system).toMatch(/FORMAT, LENGTH AND ROLE/);
    expect(system).toMatch(/NEVER ask to cut just to reach one page/);
    expect(system).not.toMatch(/single page/);
  });
});
