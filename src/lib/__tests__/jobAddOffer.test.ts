/** @jest-environment node */
// a Computrabajo offer that a person adds goes into the search for everybody, as the same job the scheduled reading brings
const store: Record<string, Record<string, unknown>[]> = {};
const collection = (name: string) => {
  const rows = (store[name] ??= []);
  return {
    findOne: async (f: Record<string, unknown>) => rows.find((d) => Object.entries(f).every(([k, v]) => d[k] === v)) ?? null,
    updateOne: async (f: Record<string, unknown>, u: { $set: Record<string, unknown>; $setOnInsert?: Record<string, unknown> }) => {
      const hit = rows.find((d) => Object.entries(f).every(([k, v]) => d[k] === v));
      if (hit) Object.assign(hit, u.$set);
      else rows.push({ ...u.$set, ...(u.$setOnInsert ?? {}) });
    },
  };
};
jest.mock("@/lib/ingest/run", () => ({ index: () => collection("jobs_index") }));
jest.mock("@/lib/mongodb", () => ({ db: { collection: (n: string) => collection(n) } }));

import { addComputrabajoOffer, computrabajoOffer } from "@/lib/ingest/addOffer";
import { setPace } from "@/lib/ingest/computrabajo";

const ID = "CCAF41B6CC05D56761373E686DCF3405";
const LINK = `https://pe.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-de-desarrollador-web-full-stack-en-surco-${ID}`;
const page = `<html><head><script type="application/ld+json">${JSON.stringify({
  "@graph": [
    {
      "@type": "JobPosting",
      title: "Desarrollador Web Full Stack",
      description: "Buscamos una persona con experiencia en Node.js y Vue.js para el equipo de tecnología de nuestra empresa. ".repeat(4),
      datePosted: "2026-10-05",
      validThrough: "2099-01-01",
      hiringOrganization: { name: "QREPS SELECCIONA" },
      jobLocation: { address: { addressLocality: "Lima", addressRegion: "Santiago De Surco" } },
      baseSalary: { currency: "PEN", value: { value: 3000, unitText: "MONTH" } },
    },
  ],
})}</script></head></html>`;

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  setPace(0);
});
afterEach(() => jest.restoreAllMocks());

describe("the link to one Computrabajo offer", () => {
  it("is known by its site and its id, and a list, another site or a filtered link are not", () => {
    expect(computrabajoOffer(LINK)).toMatchObject({ site: "pe", id: ID, host: "pe.computrabajo.com" });
    expect(computrabajoOffer(LINK.replace("pe.", "co."))).toMatchObject({ site: "co" });
    expect(computrabajoOffer("https://pe.computrabajo.com/empresas/ofertas-de-trabajo-de-x-FD65FF1729C877A8")).toBeNull();
    expect(computrabajoOffer("https://example.com/ofertas-de-trabajo/oferta-de-trabajo-de-x-" + ID)).toBeNull();
    // a filter in the link is not carried over: only the offer's own address is ever asked for
    expect(computrabajoOffer(LINK + "?dis=1")?.path).toBe(computrabajoOffer(LINK)?.path);
  });
});

describe("adding a Computrabajo offer", () => {
  it("reads it from its own data, puts it in the index as the same job the scheduled reading brings, and does not read it again", async () => {
    const spy = jest.spyOn(global, "fetch").mockImplementation(async () => new Response(page, { status: 200 }));
    const job = await addComputrabajoOffer(LINK);
    expect(job).toMatchObject({ key: `computrabajo:pe:${ID}`, source: "computrabajo", title: "Desarrollador Web Full Stack", company: "QREPS SELECCIONA", country: "PE", salary: "S/ 3,000 per month", board: "computrabajo:pe:added" });
    const doc = store.jobs_index[0];
    expect(doc).toMatchObject({ key: `computrabajo:pe:${ID}`, active: true, lang: "es" });
    expect(doc.expiresAt).toBeInstanceOf(Date);
    expect(doc.firstSeenAt).toBeInstanceOf(Date);
    expect(spy).toHaveBeenCalledTimes(1);

    const again = await addComputrabajoOffer(LINK);
    expect(again?.title).toBe("Desarrollador Web Full Stack");
    expect(spy).toHaveBeenCalledTimes(1); // the second time nothing is asked of Computrabajo
  });

  it("is null for what is not an offer, or when the page cannot be read or has ended", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async () => new Response("", { status: 404 }));
    expect(await addComputrabajoOffer("https://example.com/job/1")).toBeNull();
    expect(await addComputrabajoOffer(LINK)).toBeNull();
    jest.spyOn(global, "fetch").mockImplementation(async () => new Response(page.replace("2099-01-01", "2020-01-01"), { status: 200 }));
    expect(await addComputrabajoOffer(LINK)).toBeNull();
    expect(store.jobs_index ?? []).toHaveLength(0);
  });
});
