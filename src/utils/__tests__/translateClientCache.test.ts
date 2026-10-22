jest.mock("@/lib/authFetch", () => ({ authFetch: jest.fn() }));
import { authFetch } from "@/lib/authFetch";
import { translateProfile } from "@/utils/translateClient";

const mockServer = () =>
  (authFetch as jest.Mock).mockImplementation(async (_url: string, init: { body: string }) => {
    const { texts } = JSON.parse(init.body) as { texts: string[] };
    return { ok: true, json: async () => ({ texts: texts.map((t) => `ES:${t}`) }) };
  });

const profile = (skills: string[]) =>
  ({ jobTitle: "Software Engineer", careerObjective: "", jobHistory: [], education: [], skills }) as never;

beforeEach(() => {
  localStorage.clear();
  (authFetch as jest.Mock).mockReset();
  mockServer();
});

describe("translating with what is already known", () => {
  it("sends only the texts not translated before, and never the same text twice", async () => {
    const first = await translateProfile(profile(["Teamwork", "Leadership"]), "es");
    expect(first.skills).toEqual(["ES:Teamwork", "ES:Leadership"]);
    expect((authFetch as jest.Mock).mock.calls).toHaveLength(1);

    // the same resume again: nothing is asked
    (authFetch as jest.Mock).mockClear();
    const again = await translateProfile(profile(["Teamwork", "Leadership"]), "es");
    expect(again.skills).toEqual(["ES:Teamwork", "ES:Leadership"]);
    expect(authFetch).not.toHaveBeenCalled();

    // a resume with one new skill: only the new one is asked
    const third = await translateProfile(profile(["Teamwork", "Communication"]), "es");
    expect(third.skills).toEqual(["ES:Teamwork", "ES:Communication"]);
    const sent = JSON.parse(((authFetch as jest.Mock).mock.calls[0][1] as { body: string }).body).texts;
    expect(sent).toEqual(["Communication"]);
  });

  it("keeps each language apart, and nothing is remembered when the translation fails", async () => {
    await translateProfile(profile(["Teamwork"]), "es");
    (authFetch as jest.Mock).mockClear();
    await translateProfile(profile(["Teamwork"]), "en");
    expect(authFetch).toHaveBeenCalledTimes(1); // another language: asked again

    localStorage.clear();
    (authFetch as jest.Mock).mockReset().mockResolvedValue({ ok: false, json: async () => ({ error: "busy" }) });
    await expect(translateProfile(profile(["Honesty"]), "es")).rejects.toThrow("busy");
    expect(localStorage.getItem("kaizo_translations_v1")).toBeNull();
  });
});
