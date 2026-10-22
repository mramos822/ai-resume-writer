/** @jest-environment node */
import { searchJobs } from "@/lib/jobSearch";

const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
const row = { url: "https://jobviewtrack.com/v2/x", title: "Contador general", company: "Acme", date: "Tue, 20 Oct 2026 02:52:40 GMT", description: "Contador con experiencia", locations: "Santiago" };

describe("a board that answers with an error", () => {
  const oldFetch = global.fetch;
  beforeEach(() => {
    process.env.CAREERJET_API_KEY = "test";
    delete process.env.ADZUNA_APP_ID;
    delete process.env.JOOBLE_API_KEY;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    global.fetch = oldFetch;
    jest.restoreAllMocks();
  });

  it("is a failure (not 'no jobs'), is not remembered, and the next search asks it again", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(reply({ type: "ERROR", error: "Unauthorized access from IP 1.2.3.4" }))
      .mockResolvedValueOnce(reply({ type: "JOBS", hits: 1, jobs: [row] }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const q = { q: "contador", location: "", remoteOnly: false, country: "CL" };

    const first = await searchJobs(q, [], { live: "only", boards: "adzuna" });
    expect(first.jobs).toHaveLength(0);
    expect(first.failed).toEqual(["Careerjet"]);

    const second = await searchJobs(q, [], { live: "only", boards: "adzuna" });
    expect(fetchMock).toHaveBeenCalledTimes(2); // the empty answer was not kept
    expect(second.failed).toEqual([]);
    expect(second.jobs.map((j) => j.source)).toEqual(["careerjet"]);
  });
});
