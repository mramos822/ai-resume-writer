const mockCompletion = jest.fn();
jest.mock("@/lib/openaiClient", () => ({ getOpenAIChatCompletionWithFallback: (...a: unknown[]) => mockCompletion(...a) }));
jest.mock("@/lib/aiConfig", () => ({ AI_MODEL: "test" }));

import { cleanMemory, evaluateDraft } from "@/lib/applicationCoach";
import { jobScore, saysTerm } from "@/lib/jobScore";
import type { JobListing } from "@/lib/jobSearch";
import type { ProfileData } from "@/context/profileContext";

const job = (text: string): JobListing => ({ key: "k", source: "link", title: "Full Stack Developer", company: "Acme", location: "", remote: true, url: "", postedAt: "", tags: [], snippet: text, description: text });
const profile = (over: Partial<ProfileData> = {}) =>
  ({
    name: "A",
    jobTitle: "Full Stack Developer",
    careerObjective: "Computer Science graduate who builds web apps.",
    skills: ["React", "Node.js", "PostgreSQL", "Docker"],
    jobHistory: [{ id: "j1", title: "Developer", company: "X", startDate: "2024-01", endDate: "", current: true, description: "", accomplishments: ["Built a React dashboard used by 40 people."] }],
    education: [{ id: "e1", school: "NJIT", degree: "B.S. Computer Science", startDate: "2021-09", endDate: "2026-05" }],
    internships: [],
    projects: [],
    contactInfo: { email: "a@b.c", phone: "1", address: "" },
    ...over,
  }) as unknown as ProfileData;
const ask = (answer: unknown) => mockCompletion.mockResolvedValueOnce({ content: JSON.stringify(answer) });
const POSTING = "We need a full stack developer with React, Docker and scalable applications experience. CI/CD is a plus.";

describe("the review of the draft is checked by code", () => {
  beforeEach(() => mockCompletion.mockReset());

  it("keeps a keywords improvement while its terms are true, in the posting and not said yet", async () => {
    ask({ headline: "h", strengths: ["s"], improvements: [{ text: "Work Docker into your bullets", kind: "keywords", terms: ["Docker"] }] });
    const ev = await evaluateDraft(profile(), job(POSTING), { skills: [], facts: [] }, "Entry level", "en");
    expect(ev.improvements).toEqual(["Work Docker into your bullets"]);
    expect(ev.targets).toEqual(["Docker"]);
  });

  it("drops the terms that are not in the posting or that the person does not have", async () => {
    ask({ improvements: [{ text: "Add Kubernetes and scalable applications", kind: "keywords", terms: ["Kubernetes", "scalable applications", "Terraform"] }] });
    const ev = await evaluateDraft(profile(), job(POSTING), { skills: [], facts: [] }, "", "en");
    // Kubernetes is not in the posting; "scalable applications" is in the posting but the resume does not show it: neither is claimed
    expect(ev.targets).toEqual([]);
    expect(ev.improvements).toEqual([]);
  });

  it("removes the improvement once the resume says the term", async () => {
    ask({ improvements: [{ text: "Work React into your bullets", kind: "keywords", terms: ["React"] }, { text: "Make the bullets more specific", kind: "bullets" }] });
    const ev = await evaluateDraft(profile(), job(POSTING), { skills: [], facts: [] }, "", "en");
    // "React" is already in a bullet: that item is resolved by code; the other one stays
    expect(ev.improvements).toEqual(["Make the bullets more specific"]);
    expect(ev.targets).toEqual([]);
  });

  it("names the terms itself when the AI says 'work the keywords in' without naming any", async () => {
    ask({ improvements: [{ text: "Incorporate key skills from your list into your bullets", kind: "keywords" }] });
    const ev = await evaluateDraft(profile(), job(POSTING), { skills: [], facts: [] }, "", "en");
    // the posting asks for React and Docker, the resume has both, and only React is said in a bullet: Docker is what is missing
    expect(ev.targets).toEqual(["Docker"]);
    expect(ev.improvements[0]).toMatch(/Docker/);
    expect(ev.improvements[0]).not.toMatch(/React/);
  });

  it("still reads an improvement written as plain text", async () => {
    ask({ improvements: ["Tighten the objective"] });
    const ev = await evaluateDraft(profile(), job(POSTING), { skills: [], facts: [] }, "", "en");
    expect(ev.improvements).toEqual(["Tighten the objective"]);
  });
});

describe("the number moves when the resume says what the review asked for", () => {
  const p0 = profile();
  const said = profile({ careerObjective: "Computer Science graduate who builds web apps with React, Node.js and Docker." });

  it("counts a keyword only when the objective or a bullet says it", () => {
    expect(saysTerm("built a react dashboard", "React")).toBe(true);
    expect(saysTerm("built a reactive dashboard", "React")).toBe(false);
    expect(saysTerm("deployed with ci/cd pipelines", "CI/CD")).toBe(true);
  });

  it("rises when the objective works the target in, and never falls", () => {
    const before = jobScore(p0, job(POSTING), [], "classic", ["Docker"]);
    const after = jobScore(said, job(POSTING), [], "classic", ["Docker"]);
    expect(after.narrative).toBeGreaterThan(before.narrative);
    expect(after.score).toBeGreaterThanOrEqual(before.score);
  });

  it("is the same for the same resume and the same targets", () => {
    expect(jobScore(p0, job(POSTING), [], "classic", ["Docker"])).toEqual(jobScore(p0, job(POSTING), [], "classic", ["Docker"]));
  });
});

describe("a new review remembers what was already fixed", () => {
  beforeEach(() => mockCompletion.mockReset());
  const memory = { improvements: ["Rewrite the objective", "Improve the bullets of Developer"], applied: ["Rewrote the objective for this job", "Improved the bullets of Developer · X"], fixed: { objective: true, jobTitle: false, jobIds: ["j1"] } };

  it("does not raise the objective or the bullets of a job that was rewritten, even if the AI does", async () => {
    ask({
      improvements: [
        { text: "Rewrite the objective again", kind: "objective" },
        { text: "Make the Developer bullets more specific", kind: "bullets", jobId: "j1" },
        { text: "Add a certification", kind: "requirement" },
      ],
    });
    const ev = await evaluateDraft(profile(), job(POSTING), { skills: [], facts: [] }, "", "en", null, memory);
    expect(ev.improvements).toEqual(["Add a certification"]);
  });

  it("still raises the bullets of a job that was NOT rewritten", async () => {
    ask({ improvements: [{ text: "Make the other job's bullets more specific", kind: "bullets", jobId: "j2" }] });
    const ev = await evaluateDraft(profile(), job(POSTING), { skills: [], facts: [] }, "", "en", null, memory);
    expect(ev.improvements).toEqual(["Make the other job's bullets more specific"]);
  });

  it("raises everything when there is no memory (the first review)", async () => {
    ask({ improvements: [{ text: "Rewrite the objective", kind: "objective" }, { text: "Make the bullets specific", kind: "bullets", jobId: "j1" }] });
    const ev = await evaluateDraft(profile(), job(POSTING), { skills: [], facts: [] }, "", "en");
    expect(ev.improvements).toHaveLength(2);
  });

  it("gives the AI what was said and done before", async () => {
    ask({ improvements: [] });
    await evaluateDraft(profile(), job(POSTING), { skills: [], facts: [] }, "", "en", null, memory);
    const sent = JSON.parse(mockCompletion.mock.calls[0][0].messages[1].content);
    expect(sent.previous.applied).toEqual(memory.applied);
    expect(sent.previous.fixed.jobIds).toEqual(["j1"]);
  });

  it("cleans what the page sends: unknown jobs go, empty memory is nothing", () => {
    const m = cleanMemory({ improvements: ["a", ""], applied: ["done"], fixed: { objective: true, jobIds: ["j1", "ghost"] } }, profile());
    expect(m?.fixed.jobIds).toEqual(["j1"]);
    expect(m?.improvements).toEqual(["a"]);
    expect(cleanMemory({ improvements: [], applied: [], fixed: {} }, profile())).toBeUndefined();
    expect(cleanMemory("nope", profile())).toBeUndefined();
  });
});

describe("a failed answer of the AI is a failure, not an empty answer", () => {
  beforeEach(() => mockCompletion.mockReset());
  const raw = (content: string) => mockCompletion.mockResolvedValueOnce({ content });
  const { AiAnswerError, questionsFor, skillsAlreadyShown, fixesFor, objectiveWithLevelAi } = jest.requireActual("@/lib/applicationCoach") as typeof import("@/lib/applicationCoach");

  it("says there was nothing to ask when the AI says so", async () => {
    ask({ questions: [] });
    await expect(questionsFor(profile(), job(POSTING), [], "en")).resolves.toEqual([]);
  });

  it("raises an error when the answer is empty, not JSON, or lacks what was asked", async () => {
    raw("");
    await expect(questionsFor(profile(), job(POSTING), [], "en")).rejects.toBeInstanceOf(AiAnswerError);
    raw("sorry, I cannot help with that");
    await expect(questionsFor(profile(), job(POSTING), [], "en")).rejects.toBeInstanceOf(AiAnswerError);
    raw("{}");
    await expect(questionsFor(profile(), job(POSTING), [], "en")).rejects.toBeInstanceOf(AiAnswerError);
  });

  it("does the same for the review, the fixes, the skills already shown and the objective", async () => {
    raw("{}");
    await expect(evaluateDraft(profile(), job(POSTING), { skills: [], facts: [] }, "", "en")).rejects.toBeInstanceOf(AiAnswerError);
    raw("{}");
    await expect(fixesFor(profile(), job(POSTING), ["Rewrite"], { skills: [], facts: [] }, "en", null)).rejects.toBeInstanceOf(AiAnswerError);
    raw("{}");
    await expect(skillsAlreadyShown(profile(), ["Docker"])).rejects.toBeInstanceOf(AiAnswerError);
    raw("{}");
    await expect(objectiveWithLevelAi(profile(), job(POSTING), "Junior", "en")).rejects.toBeInstanceOf(AiAnswerError);
  });

  it("a real empty answer is still an answer", async () => {
    ask({ fixes: [] });
    await expect(fixesFor(profile(), job(POSTING), ["Rewrite"], { skills: [], facts: [] }, "en", null)).resolves.toEqual([]);
    ask({ shown: [] });
    await expect(skillsAlreadyShown(profile(), ["Docker"])).resolves.toEqual([]);
  });
});

describe("confirming a skill for a job", () => {
  it("never lowers the number, even though no bullet says it yet", () => {
    const p0 = profile({ skills: ["React"] });
    const before = jobScore(p0, job(POSTING), []).score;
    const withDocker = profile({ skills: ["React", "Docker"] });
    const after = jobScore(withDocker, job(POSTING), ["Docker"]).score;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});
