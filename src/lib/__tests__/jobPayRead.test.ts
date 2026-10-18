/** @jest-environment node */
import type { JobListing } from "@/lib/jobSearch";

jest.mock("@/lib/apiAuth", () => ({ HttpError: class extends Error {} }));
const pages: Record<string, string | null> = {};
jest.mock("@/lib/jobAdText", () => ({ fetchJobAdText: async (url: string) => pages[url] ?? null }));

import { enrichListings, readPay } from "@/lib/jobEnrich";

const CUT = "L3Harris is dedicated to recruiting and developing high-performing talent who are passionate about what they do. Our employees are unified in a shared dedication to our customers' mission and quest for professional growth. L3Harris provides an inclusive, engaging environment designed to empower employees and promote…";
const job = (id: string): JobListing => ({ key: `adzuna:${id}`, source: "adzuna", title: "Intern, Software Engineer", company: "Harris", location: "Clifton", remote: false, url: `https://pages.test/${id}`, postedAt: "", tags: [], snippet: CUT, description: CUT });
const page = (extra: string) => `Title: Intern\nCompany: Harris\n\n${"Apply computer science concepts to embedded software. ".repeat(20)} ${extra}`;

describe("the pay of a posting, read from its page", () => {
  it("is taken from the text of the page: a pay, none, or not readable", async () => {
    pages["https://pages.test/a"] = page("The pay range for this role in New Jersey is $29 / hr - $53.50 / hr.This is not a guarantee of compensation.");
    pages["https://pages.test/b"] = page("A great team and benefits.");
    pages["https://pages.test/c"] = null;
    expect(await readPay(job("a"))).toBe("$29 – $53.50 per hour");
    expect(await readPay(job("b"))).toBeNull();
    expect(await readPay(job("c"))).toBeUndefined();
  });

  it("is given to a listing that came cut and without pay, even when the pay is past the text that is kept", async () => {
    pages["https://pages.test/d"] = page("Duties. ".repeat(600) + "The salary range for this role is $90,000 - $120,000 per year.");
    const [read] = await enrichListings([job("d")], 1, 5000);
    expect(read.salary).toBe("$90,000 – $120,000");
    expect((read.description ?? "").length).toBeLessThanOrEqual(3500);
  });
});
