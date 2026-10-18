/** @jest-environment node */
import { allowed, BlockedError, CT_NEW_PER_RUN, fetchComputrabajo, fromComputrabajo, jobPostingOf, offerOfListLink, offersOn, setPace } from "@/lib/ingest/computrabajo";
import type { Board } from "@/lib/ingest/boards";

const B: Board = { source: "computrabajo", token: "pe:tech", name: "Computrabajo" };
const hex = (n: number) => String(n).padStart(32, "A").slice(-32).toUpperCase();
const path = (n: number) => `/ofertas-de-trabajo/oferta-de-trabajo-de-puesto-${n}-en-lima-${hex(n)}`;

const listPage = (ns: number[]) => `<html><body>${ns.map((n) => `<article class="box_offer"><h2><a href="${path(n)}#lc=ListOffers-Score4-${n}">Puesto ${n}</a></h2><a href="${path(n)}#x">again</a></article>`).join("")}<a href="/ofertas-de-trabajo/oferta-de-trabajo-de-x-${hex(1)}?dis=1">filtered</a><a href="/go/abc">go</a></body></html>`;

const offerPage = (over: Record<string, unknown> = {}) =>
  `<html><head><script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org/",
    "@graph": [
      { "@type": "Organization", name: "Computrabajo Perú" },
      {
        "@type": "JobPosting",
        title: "Asistente de monitoreo GPS",
        description: "ASISTENTE DE MONITOREO GPS\nMonitoreo de la flota en tiempo real.<br/><br/> -Requerimientos- Educación mínima: Secundaria",
        industry: "Logística",
        datePosted: "2026-10-13",
        validThrough: "2099-12-12",
        employmentType: "FULL_TIME",
        hiringOrganization: { name: "QREPS SELECCIONA S.R.L.", logo: "https://ii.ct-stc.com/logo.png" },
        jobLocation: { address: { addressLocality: "Lima", addressRegion: "Ate", addressCountry: "Perú" } },
        baseSalary: { currency: "PEN", value: { value: 1530, unitText: "MONTH" } },
        ...over,
      },
    ],
  })}</script></head><body></body></html>`;

describe("reading a Computrabajo posting", () => {
  it("turns the data the page publishes into a job: the place, the pay in soles, the date, the link", () => {
    const j = fromComputrabajo(B, offerPage(), path(7), hex(7), Date.parse("2026-10-18"))!;
    expect(j).toMatchObject({
      key: `computrabajo:pe:${hex(7)}`,
      source: "computrabajo",
      title: "Asistente de monitoreo GPS",
      company: "QREPS SELECCIONA S.R.L.",
      location: "Lima, Ate",
      remote: false,
      country: "PE",
      salary: "S/ 1,530 per month",
      board: "computrabajo:pe:tech",
      url: `https://pe.computrabajo.com${path(7)}`,
      tags: ["Full time", "Logística"],
    });
    expect(j.postedAt).toBe("2026-10-13T00:00:00.000Z");
    expect(j.description).toContain("Monitoreo de la flota");
    expect(j.description).not.toContain("<");
  });

  it("reads the pay from the text when the page publishes none, and the remote jobs", () => {
    const j = fromComputrabajo(B, offerPage({ baseSalary: undefined, title: "Analista de datos remoto", description: "Trabajo 100% remoto. Sueldo: S/ 3,500 a S/ 4,500 mensuales." }), path(8), hex(8))!;
    expect(j.remote).toBe(true);
    expect(j.salary).toBe("S/ 3,500 – S/ 4,500 per month");
  });

  it("leaves out an offer whose time is over, and a page that is not a posting", () => {
    expect(fromComputrabajo(B, offerPage({ validThrough: "2020-01-01" }), path(9), hex(9))).toBeNull();
    expect(fromComputrabajo(B, "<html><body>nothing</body></html>", path(9), hex(9))).toBeNull();
    expect(jobPostingOf("<html></html>")).toBeNull();
  });
});

describe("the lists and what robots.txt leaves open", () => {
  it("takes the postings a list page links to, once each, and not the filtered or forwarding links", () => {
    const found = offersOn(listPage([1, 2, 3]));
    expect(found.map((o) => o.id)).toEqual([hex(1), hex(2), hex(3)]);
    expect(found[0].path).toBe(path(1));
  });

  it("allows the postings and the searches by title and their pages, and nothing that filters", () => {
    expect(allowed(path(1))).toBe(true);
    expect(allowed("/trabajo-de-desarrollador")).toBe(true);
    expect(allowed("/trabajo-de-desarrollador?p=2")).toBe(true);
    expect(allowed("/ofertas-de-trabajo/x?dis=1")).toBe(false);
    expect(allowed("/empresas/x?city=3")).toBe(false);
    expect(allowed("/go/abc")).toBe(false);
    expect(allowed("/Ajax/something")).toBe(false);
    expect(allowed("/hojas-de-vida/x")).toBe(false);
  });
});

describe("reading a board of Computrabajo", () => {
  beforeEach(() => setPace(0));
  afterEach(() => jest.restoreAllMocks());

  const serve = (lists: Record<string, number[]>, over?: (url: string) => Response | undefined) => {
    const asked: string[] = [];
    jest.spyOn(global, "fetch").mockImplementation(async (u) => {
      const url = String(u);
      asked.push(url);
      const special = over?.(url);
      if (special) return special;
      if (url.includes("/ofertas-de-trabajo/")) return new Response(offerPage(), { status: 200 });
      const m = /trabajo-de-([a-z-]+)(\?p=(\d+))?/.exec(url);
      return new Response(listPage(lists[`${m?.[1]}:${m?.[3] ?? 1}`] ?? []), { status: 200 });
    });
    return asked;
  };

  it("reads the new postings once, only counts the known ones as open, and goes page by page", async () => {
    const asked = serve({ "desarrollador:1": [1, 2, 3], "desarrollador:2": [4], "programador:1": [3, 5] });
    const known = new Set([`computrabajo:pe:${hex(2)}`]);
    const read = await fetchComputrabajo(B, known);
    expect(read.seen).toEqual([`computrabajo:pe:${hex(2)}`]);
    expect(read.jobs.map((j) => j.key)).toEqual([1, 3, 4, 5].map((n) => `computrabajo:pe:${hex(n)}`));
    // every posting page was asked once (the known one never), and no request had a filter
    expect(asked.filter((u) => u.includes("/ofertas-de-trabajo/")).length).toBe(4);
    expect(asked.some((u) => /[?&](dis|cont|pubdate|sal|by|emp)=/.test(u))).toBe(false);
    expect(asked.every((u) => u.startsWith("https://pe.computrabajo.com/"))).toBe(true);
  });

  it("reads no more than a run may, and stops on the first page of a search that has no postings", async () => {
    const many = Array.from({ length: CT_NEW_PER_RUN + 25 }, (_, i) => i + 1);
    const asked = serve({ "desarrollador:1": many });
    const read = await fetchComputrabajo(B, new Set());
    expect(read.jobs.length).toBe(CT_NEW_PER_RUN);
    expect(asked.filter((u) => u.includes("trabajo-de-desarrollador?p=3")).length).toBe(0);
  });

  it("stops at once when the site turns a request away: a list that is turned away ends the run, a posting keeps what was read", async () => {
    serve({}, () => new Response("", { status: 429 }));
    await expect(fetchComputrabajo(B, new Set())).rejects.toBeInstanceOf(BlockedError);

    let offers = 0;
    serve({ "desarrollador:1": [1, 2, 3, 4] }, (url) => {
      if (!url.includes("/ofertas-de-trabajo/")) return undefined;
      offers++;
      return offers > 2 ? new Response("", { status: 403 }) : undefined;
    });
    const read = await fetchComputrabajo(B, new Set());
    expect(read.jobs.length).toBe(2); // the two read before it was turned away
    expect(offers).toBe(3); // and no fourth request
  });

  it("asks for nothing it does not know: an unknown board is an error", async () => {
    await expect(fetchComputrabajo({ source: "computrabajo", token: "xx:nope" }, new Set())).rejects.toThrow(/unknown board/);
  });
});

describe("a link copied from a company page with one offer open", () => {
  const LIST = "https://pe.computrabajo.com/empresas/ofertas-de-trabajo-de-qreps-selecciona-FD65FF1729C877A8";
  beforeEach(() => setPace(0));
  afterEach(() => jest.restoreAllMocks());

  it("is the address of that offer: the id after the # is looked up in the list page", async () => {
    const spy = jest.spyOn(global, "fetch").mockImplementation(async () => new Response(listPage([1, 2, 3]), { status: 200 }));
    expect(await offerOfListLink(`${LIST}#${hex(2)}`)).toBe(`https://pe.computrabajo.com${path(2)}`);
    expect(String(spy.mock.calls[0][0])).toBe(LIST); // the # is not sent, and only the list page is asked for
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("is nothing when the link is not of that kind or the offer is not on the page", async () => {
    const spy = jest.spyOn(global, "fetch").mockImplementation(async () => new Response(listPage([1, 2, 3]), { status: 200 }));
    expect(await offerOfListLink(LIST)).toBeNull(); // no id: nothing is asked for
    expect(await offerOfListLink(`https://example.com/empresas/x#${hex(2)}`)).toBeNull(); // another site
    expect(await offerOfListLink(`https://pe.computrabajo.com${path(2)}#${hex(2)}`)).toBeNull(); // already an offer
    expect(spy).not.toHaveBeenCalled();
    expect(await offerOfListLink(`${LIST}#${hex(99)}`)).toBeNull(); // not on the page
  });

  it("is nothing when the site turns the request away", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async () => new Response("", { status: 429 }));
    expect(await offerOfListLink(`${LIST}#${hex(2)}`)).toBeNull();
  });
});
