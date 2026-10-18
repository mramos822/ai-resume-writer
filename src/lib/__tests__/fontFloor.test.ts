/**
 * @jest-environment node
 */
import { renderResumeDetailed } from "@/lib/pdfResume";
import type { ProfileData } from "@/context/profileContext";

jest.setTimeout(120000);

const job = (n: number, title: string, bullets = 4) => ({ id: String(n), company: `Company ${n}`, title, description: "", location: "New Jersey", startDate: "2016-01", endDate: n === 1 ? "" : "2019-06", current: n === 1, accomplishments: Array.from({ length: bullets }, (_, i) => `Built and maintained a feature number ${i + 1} that improved reliability and reduced cost for more than 40 teams across the company.`) });
const dense = {
  name: "Mariano Ramos", jobTitle: "Full-Stack Developer", contactInfo: { email: "m@example.com", phone: "(786) 366-5315", address: "Hillside, NJ" },
  careerObjective: "Computer Science graduate who takes work from first commit to production and stays responsible for it: React and Next.js on the front end, REST and real-time APIs on Node, and the PostgreSQL schema and CI/CD underneath. US citizen, available immediately.",
  skills: ["TypeScript", "JavaScript", "Python", "Java", "C++", "SQL", "Bash", "React", "Next.js", "Tailwind CSS", "Node.js", "REST API design", "PostgreSQL", "Docker", "CI/CD", "GitHub Actions", "Linux", "Supabase", "Agile", "Three.js", "WebGL", "Redis", "AWS", "GraphQL", "Jest"],
  jobHistory: [job(1, "Founder & Software Engineer"), job(2, "Rideshare Driver", 3), job(3, "Barista", 2), job(4, "Sales Associate", 2)],
  education: [{ id: "e1", school: "New Jersey Institute of Technology", degree: "B.S. Computer Science", startDate: "2021-09", endDate: "2026-05" }, { id: "e2", school: "Union County College", degree: "A.S. Computer Information Systems", startDate: "2019-01", endDate: "2021-05" }],
  internships: [],
  projects: [1, 2, 3].map((n) => ({ id: "p" + n, name: `Project ${n}`, description: "A capstone project.", technologies: ["Java", "Node.js"], startDate: "2025-01", endDate: "2025-06", accomplishments: ["Built the backend logic for LLM tools producing real-time market insights.", "Delivered across four two-week sprints with peer code review."] })),
  languages: [{ name: "English", level: "Native" }, { name: "Spanish", level: "Native" }],
  links: [{ label: "GitHub", url: "github.com/x" }], certifications: [], interests: [],
} as unknown as ProfileData;

describe("a lot of content: one page, and the page is used", () => {
  // the skills go in short paragraphs by group, not one row each, so the column that held them no longer sets the size of the whole page
  it.each(["noir", "pastel", "blossom"])("%s keeps the text at a size that is not tiny on one page", async (look) => {
    const r = await renderResumeDetailed(dense, look, {});
    expect(r.pages).toBe(1);
    expect(r.scale).toBeGreaterThanOrEqual(0.55); // (Blossom, the roomiest look, was 58% before the skills were grouped; real resumes reach 66%)
  });

  it("everything goes on ONE page in every look, however much content there is", async () => {
    for (const look of ["noir", "blossom", "banner", "atelier", "shokumu"]) {
      const r = await renderResumeDetailed(dense, look, {});
      expect({ look, pages: r.pages }).toEqual({ look, pages: 1 });
    }
  });

  it("a short resume is untouched", async () => {
    const short = { ...dense, jobHistory: [job(1, "Developer", 3)], projects: [], skills: ["React", "Node.js"] } as unknown as ProfileData;
    const r = await renderResumeDetailed(short, "classic", {});
    expect(r.pages).toBe(1);
    expect(r.scale).toBe(1);
  });
});
