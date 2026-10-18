import { faithfulBullets, unsupportedIn } from "@/lib/bulletFidelity";

const uber = {
  title: "Rideshare Driver",
  company: "Uber",
  description: "Self-employed",
  accomplishments: ["Self-employed work scheduled around a full course load, funding the degree while continuing to build software."],
};
const founder = {
  title: "Founder & Software Engineer",
  company: "myGeoChallenge",
  description: "",
  accomplishments: [
    "Built a Three.js/WebGL 3D globe with custom drag-and-drop hit-testing and an EN/ES i18n layer.",
    "Designed the PostgreSQL schema with 22 versioned migrations and row-level security for 130+ users.",
  ],
};

describe("a rewritten bullet may say the same better, but not more", () => {
  it("accepts a bullet that only rewords what the job said", () => {
    const bad = unsupportedIn("Developed a Three.js and WebGL 3D globe with custom drag-and-drop hit-testing.", `${founder.accomplishments.join(" ")} ${founder.title}`);
    expect(bad).toEqual({ skills: [], numbers: [] });
  });

  it("rejects a tool the job never showed (a driving job does not use Docker)", () => {
    const bad = unsupportedIn("Maintained Docker and Kubernetes deployments while driving for Uber.", `${uber.title} ${uber.company} ${uber.accomplishments.join(" ")}`);
    expect(bad.skills.length).toBeGreaterThan(0);
  });

  it("rejects a number that was not in the job", () => {
    const bad = unsupportedIn("Completed 5,000 rides with a 4.9 rating.", `${uber.title} ${uber.accomplishments.join(" ")}`);
    expect(bad.numbers).toEqual(expect.arrayContaining(["5,000", "4.9"]));
  });

  it("keeps the numbers that were there", () => {
    const bad = unsupportedIn("Designed the PostgreSQL schema: 22 versioned migrations and security for 130+ users.", founder.accomplishments.join(" "));
    expect(bad.numbers).toEqual([]);
  });

  it("lets a skill through when the person confirmed it for this job", () => {
    const source = `${uber.title} ${uber.accomplishments.join(" ")}`;
    expect(unsupportedIn("Maintained Docker deployments.", source).skills.length).toBeGreaterThan(0);
    expect(unsupportedIn("Maintained Docker deployments.", source, "Docker").skills).toEqual([]);
  });

  it("does not count soft skills that rewording brings", () => {
    const bad = unsupportedIn("Showed teamwork and communication with clients.", `${uber.title} ${uber.accomplishments.join(" ")}`);
    expect(bad.skills).toEqual([]);
  });
});

describe("the bullets that go on the resume", () => {
  it("puts an unfaithful bullet back as the person wrote it", () => {
    const out = faithfulBullets(
      founder,
      ["Developed a Three.js and WebGL 3D globe with custom hit-testing.", "Optimized Docker and AWS pipelines serving 10,000 users."],
      ""
    );
    expect(out.replaced).toBe(1);
    expect(out.bullets[0]).toMatch(/Three\.js/);
    expect(out.bullets[1]).toBe(founder.accomplishments[1]);
  });

  it("leaves out an unfaithful bullet that has no original in its place", () => {
    const out = faithfulBullets(uber, ["Self-employed work around a full course load.", "Maintained Kubernetes clusters for 40 clients."], "");
    expect(out.bullets).toEqual(["Self-employed work around a full course load."]);
    expect(out.replaced).toBe(1);
  });

  it("changes nothing when every bullet is faithful", () => {
    const out = faithfulBullets(founder, [...founder.accomplishments], "");
    expect(out.replaced).toBe(0);
    expect(out.bullets).toEqual(founder.accomplishments);
  });
});
