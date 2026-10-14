import { cleanSkillGroups, groupSkills, hasSkillGroups } from "@/lib/skillGroups";

describe("skill groups", () => {
  const skills = ["Java", "React", "Git", "Python", "Excel"];
  const groups = { Java: "Languages", Python: "Languages", React: "Frameworks" };

  it("puts the skills in groups, in the order the first skill of each appears", () => {
    expect(groupSkills(skills, groups)).toEqual([
      { label: "Languages", skills: ["Java", "Python"] },
      { label: "Frameworks", skills: ["React"] },
      { label: "", skills: ["Git", "Excel"] },
    ]);
  });

  it("is one plain list when there are no groups", () => {
    expect(groupSkills(skills, undefined)).toEqual([{ label: "", skills }]);
    expect(hasSkillGroups(skills, {})).toBe(false);
    expect(hasSkillGroups(skills, groups)).toBe(true);
  });

  it("forgets the groups of skills that were removed and trims names", () => {
    expect(cleanSkillGroups(["Java"], { Java: "  Languages ", Gone: "Tools" })).toEqual({ Java: "Languages" });
  });
});

import { autoGroupSkills, groupsFromCategories } from "@/lib/skillCategories";

describe("groups made by the program", () => {
  it("groups known skills automatically, only when at least two share a group, and never touches what the person did", () => {
    const skills = ["Java", "Python", "React", "PostgreSQL", "MySQL", "Excel"];
    const out = autoGroupSkills(skills, { Excel: "Mine" });
    expect(out).toMatchObject({ Java: "Programming languages", Python: "Programming languages", PostgreSQL: "Databases", MySQL: "Databases", Excel: "Mine" });
    expect(out.React).toBeUndefined(); // alone in its group
  });

  it("reads the groups written on a resume and adds the skills that were missing", () => {
    const r = groupsFromCategories(["Java"], [{ name: "Languages", skills: ["Java", "C++"] }, { name: "Cloud/Backend", skills: ["Firebase"] }]);
    expect(r.skills).toEqual(["Java", "C++", "Firebase"]);
    expect(r.skillGroups).toEqual({ Java: "Languages", "C++": "Languages", Firebase: "Cloud/Backend" });
    expect(groupsFromCategories(["A"], undefined)).toEqual({ skills: ["A"], skillGroups: {} });
  });
});

import { labeledLink, shortContactLink } from "@/lib/links";

describe("LinkedIn links", () => {
  it("shows only /in/name where the icon or the label already says LinkedIn", () => {
    expect(shortContactLink("https://www.linkedin.com/in/mariano-ramos-3b471a293/")).toBe("in/mariano-ramos-3b471a293");
    expect(labeledLink("LinkedIn", "https://linkedin.com/in/sam?trk=x")).toBe("in/sam");
    expect(labeledLink("GitHub", "https://github.com/sam")).toBe("github.com/sam");
    expect(shortContactLink("https://github.com/sam")).toBe("github.com/sam");
  });
});
