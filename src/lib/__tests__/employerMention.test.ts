import { employerCore, namesEmployer, withoutEmployer } from "@/lib/employerMention";

describe("a resume never names the employer it is sent to", () => {
  it("looks for the company without its legal ending", () => {
    expect(employerCore("Acme Inc.")).toBe("Acme");
    expect(employerCore("JSR Tech Consulting LLC")).toBe("JSR Tech Consulting");
    expect(employerCore("AB")).toBe("");
  });

  it("finds the name as a whole word, in any case", () => {
    expect(namesEmployer("Eager to join JSR Tech Consulting as an engineer.", "JSR Tech Consulting")).toBe(true);
    expect(namesEmployer("built tools for jsr tech consulting clients", "JSR Tech Consulting LLC")).toBe(true);
    expect(namesEmployer("Built a Javascript app", "Java")).toBe(false);
    expect(namesEmployer("Anything at all", "")).toBe(false);
  });

  it("takes out only the sentences that name it", () => {
    const text = "Computer Science graduate who ships features end to end. I want to grow at Acme Inc. today. Strong with React and Node.";
    expect(withoutEmployer(text, "Acme Inc.")).toBe("Computer Science graduate who ships features end to end. Strong with React and Node.");
    expect(withoutEmployer("No company here.", "Acme Inc.")).toBe("No company here.");
  });
});
