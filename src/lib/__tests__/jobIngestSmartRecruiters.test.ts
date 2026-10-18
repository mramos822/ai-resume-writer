/** @jest-environment node */
import type { Board } from "@/lib/ingest/boards";

// jobs_index in memory
type Doc = Record<string, unknown>;
const rows: Doc[] = [];
const match = (d: Doc, f: Doc): boolean =>
  Object.entries(f).every(([k, v]) => {
    if (v && typeof v === "object" && "$in" in (v as object)) return (v as { $in: unknown[] }).$in.includes(d[k]);
    if (v && typeof v === "object" && "$lt" in (v as object)) return (d[k] as Date) < (v as { $lt: Date }).$lt;
    return d[k] === v;
  });
jest.mock("@/lib/mongodb", () => ({
  db: {
    collection: () => ({
      find: (f: Doc) => ({ project: () => ({ toArray: async () => rows.filter((d) => match(d, f)).map((d) => ({ key: d.key })) }) }),
      bulkWrite: async (ops: { updateOne: { filter: Doc; update: { $set: Doc; $setOnInsert: Doc } } }[]) => {
        for (const { updateOne: o } of ops) {
          const hit = rows.find((d) => match(d, o.filter));
          if (hit) Object.assign(hit, o.update.$set);
          else rows.push({ ...o.update.$set, ...o.update.$setOnInsert });
        }
      },
      updateMany: async (f: Doc, u: { $set: Doc }) => {
        const hit = rows.filter((d) => match(d, f));
        hit.forEach((d) => Object.assign(d, u.$set));
        return { modifiedCount: hit.length };
      },
    }),
  },
}));

import { fromSmartRecruiters, fetchSmartRecruiters, SR_NEW_PER_RUN } from "@/lib/ingest/ats";
import { ingestBoard } from "@/lib/ingest/run";

const B: Board = { source: "smartrecruiters", token: "Sodexo", name: "Sodexo" };
const item = (id: string) => ({ id, name: `Cook ${id}`, releasedDate: "2026-10-16T03:38:22.927Z", ref: `https://api.smartrecruiters.com/v1/companies/Sodexo/postings/${id}`, location: { fullLocation: "Newark, NJ, United States", remote: false }, department: { label: "Kitchen" }, typeOfEmployment: { label: "Full-time" } });
const detail = (id: string) => ({
  postingUrl: `https://jobs.smartrecruiters.com/Sodexo/${id}-cook`,
  company: { name: "Sodexo" },
  jobAd: {
    sections: {
      companyDescription: { title: "Company", text: "<p>We are a big company with lots of marketing text.</p>" },
      jobDescription: { title: "Job Description", text: "<p>Prepare meals for our clients every day, following the recipes and the safety rules of the kitchen.</p>" },
      qualifications: { title: "Qualifications", text: "<ul><li>2 years of experience in a professional kitchen</li><li>Food handler card</li></ul>" },
    },
  },
});

/** The list answers with the given ids, and every posting detail with its own text. */
function api(ids: string[], total = ids.length) {
  return jest.spyOn(global, "fetch").mockImplementation(async (u) => {
    const url = String(u);
    const m = /postings\/(\d+)$/.exec(url);
    if (m) return new Response(JSON.stringify(detail(m[1])), { status: 200 });
    const offset = Number(/offset=(\d+)/.exec(url)?.[1] ?? 0);
    return new Response(JSON.stringify({ totalFound: total, content: ids.slice(offset, offset + 100).map(item) }), { status: 200 });
  });
}

describe("reading SmartRecruiters", () => {
  beforeEach(() => {
    rows.length = 0;
  });
  afterEach(() => jest.restoreAllMocks());

  it("turns a posting into a job: what the job is and asks for, not the company's marketing", () => {
    const j = fromSmartRecruiters(B, item("1"), detail("1"))!;
    expect(j).toMatchObject({ key: "smartrecruiters:Sodexo:1", source: "smartrecruiters", company: "Sodexo", title: "Cook 1", location: "Newark, NJ, United States", remote: false, board: "smartrecruiters:Sodexo", tags: ["Kitchen", "Full-time"] });
    expect(j.description).toContain("## Job Description");
    expect(j.description).toContain("- 2 years of experience in a professional kitchen");
    expect(j.description).not.toContain("marketing");
  });

  it("keeps accents and other letters as they are written", () => {
    const d = detail("5");
    d.jobAd.sections.jobDescription.text = "<p>Réceptionniste: vous prenez soin de nos clients à leur arrivée, façon « sur mesure ». Mitarbeiter für Küche. Ñandú.</p>";
    const j = fromSmartRecruiters(B, { ...item("5"), name: "FR - Réceptionniste (H/F/X)" }, d)!;
    expect(j.title).toBe("FR - Réceptionniste (H/F/X)");
    expect(j.description).toContain("Réceptionniste: vous prenez soin de nos clients à leur arrivée, façon « sur mesure ». Mitarbeiter für Küche. Ñandú.");
  });

  it("leaves out a posting without a text to read", () => {
    expect(fromSmartRecruiters(B, item("2"), { postingUrl: "https://x.test/2", jobAd: { sections: {} } })).toBeNull();
  });

  it("does not read again what the index already has, and reads only a limited number of new postings per run", async () => {
    const ids = Array.from({ length: SR_NEW_PER_RUN + 40 }, (_, i) => String(1000 + i));
    const spy = api(ids);
    const known = new Set(ids.slice(0, 10).map((id) => `smartrecruiters:Sodexo:${id}`));
    const r = await fetchSmartRecruiters(B, known);
    expect(r.seen).toHaveLength(10);
    expect(r.jobs).toHaveLength(SR_NEW_PER_RUN);
    const detailCalls = spy.mock.calls.filter(([u]) => /postings\/\d+$/.test(String(u))).length;
    expect(detailCalls).toBe(SR_NEW_PER_RUN); // none of the 10 known ones was asked for
  });

  it("keeps the known postings open on the next run without reading them, reads the new ones, and closes the ones that are gone", async () => {
    api(["1", "2", "3"]);
    const t1 = new Date("2026-10-18T10:00:00Z");
    expect(await ingestBoard(B, t1)).toMatchObject({ jobs: 3, closed: 0 });

    jest.restoreAllMocks();
    const spy = api(["2", "3", "4"]); // 1 was taken down, 4 is new
    const t2 = new Date("2026-10-18T11:00:00Z");
    const res = await ingestBoard(B, t2);
    expect(res).toMatchObject({ jobs: 1, closed: 1 });
    expect(spy.mock.calls.filter(([u]) => /postings\/\d+$/.test(String(u))).map(([u]) => String(u).split("/").pop())).toEqual(["4"]);
    const byKey = Object.fromEntries(rows.map((r) => [String(r.key), r.active]));
    expect(byKey).toEqual({ "smartrecruiters:Sodexo:1": false, "smartrecruiters:Sodexo:2": true, "smartrecruiters:Sodexo:3": true, "smartrecruiters:Sodexo:4": true });
  });

  it("closes nothing when the company shows no postings at all", async () => {
    api(["1"]);
    await ingestBoard(B, new Date("2026-10-18T10:00:00Z"));
    jest.restoreAllMocks();
    api([]);
    expect(await ingestBoard(B, new Date("2026-10-18T11:00:00Z"))).toMatchObject({ jobs: 0, closed: 0 });
    expect(rows[0].active).toBe(true);
  });
});
