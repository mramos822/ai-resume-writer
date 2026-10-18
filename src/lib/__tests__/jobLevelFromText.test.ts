/** @jest-environment node */
import { levelFromText, levelOf } from "@/lib/jobLevel";

// the OpenAI "Dots" posting: no level in the title, no years, no technologies; one sentence says who they look for
const DOTS = `About the Team

Dots is building personal AI agents that help people make progress on their goals.

About the Role

We are looking for Senior and Staff Full Stack Software Engineers to build Dots product experiences from the interface through the services that power them. You will help define how people delegate tasks to personal agents.

You might thrive in this role if you:

Have significant experience building and shipping products across frontend and backend systems.`;

describe("the level a posting declares in its text when its title does not", () => {
  it("reads 'Senior and Staff' as Senior (they hire from the lower one)", () => {
    expect(levelFromText(DOTS)).toEqual({ label: "Senior", typical: 5 });
    expect(levelOf({ title: "Software Engineer, Full Stack — Dots", description: DOTS, snippet: "" })).toEqual({ label: "Senior", years: 5 });
  });

  it("reads one level, or the lowest of several", () => {
    expect(levelFromText("We are looking for a Staff Software Engineer to join the platform team.")).toEqual({ label: "Principal", typical: 8 });
    expect(levelFromText("We are hiring Junior and Senior developers.")?.label).toBe("Entry level");
    expect(levelFromText("We're seeking an entry-level analyst.")?.label).toBe("Entry level");
    expect(levelFromText("Looking for a team lead engineer for our payments group.")?.label).toBe("Lead");
  });

  it("does not take a word that is not about the person they look for", () => {
    expect(levelFromText("Our Lead Generation team is hiring across the country.")).toBeNull();
    expect(levelFromText("You will work with senior engineers and staff from design.")).toBeNull();
    expect(levelFromText("We are looking for a developer who loves product work.")).toBeNull();
    expect(levelFromText("")).toBeNull();
  });

  it("a title that says its level is not changed by the text", () => {
    expect(levelOf({ title: "Junior Developer", description: "We are looking for Senior and Staff engineers to mentor.", snippet: "" }).label).toBe("Entry level");
    expect(levelOf({ title: "Senior Software Engineer", description: "We are looking for a junior to help.", snippet: "" }).label).toBe("Senior");
  });
});
