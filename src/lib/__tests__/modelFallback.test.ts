const create = jest.fn();
jest.mock("openai", () => ({ __esModule: true, default: class { chat = { completions: { create: (...a: unknown[]) => create(...a) } }; } }));
jest.mock("@/lib/aiConfig", () => ({ AI_API_KEY: "k", AI_BASE_URL: "http://x", AI_MODEL: "fast-model", AI_MODEL_STRONG: "strong-model" }));

import { getOpenAIChatCompletionWithFallback } from "@/lib/openaiClient";

const ok = (text: string) => ({ choices: [{ message: { content: text } }] });
const params = (model: string) => ({ model, messages: [{ role: "user" as const, content: "hi" }] });

describe("a strong model having a bad moment never leaves the person with nothing", () => {
  beforeEach(() => {
    create.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("uses the model asked for when it works", async () => {
    create.mockResolvedValueOnce(ok('{"a":1}'));
    const r = await getOpenAIChatCompletionWithFallback(params("strong-model"));
    expect(r.content).toBe('{"a":1}');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].model).toBe("strong-model");
  });

  it("answers with the standard model when the strong one fails (busy, quota, unavailable)", async () => {
    create.mockRejectedValueOnce(new Error("503 Service Unavailable")).mockResolvedValueOnce(ok('{"b":2}'));
    const r = await getOpenAIChatCompletionWithFallback(params("strong-model"));
    expect(r.content).toBe('{"b":2}');
    expect(create.mock.calls.map((c) => c[0].model)).toEqual(["strong-model", "fast-model"]);
  });

  it("does not ask the same model twice when it already is the standard one", async () => {
    create.mockRejectedValueOnce(new Error("503"));
    await expect(getOpenAIChatCompletionWithFallback(params("fast-model"))).rejects.toThrow("503");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("fails when both fail", async () => {
    create.mockRejectedValue(new Error("down"));
    await expect(getOpenAIChatCompletionWithFallback(params("strong-model"))).rejects.toThrow("down");
    expect(create).toHaveBeenCalledTimes(2);
  });
});
