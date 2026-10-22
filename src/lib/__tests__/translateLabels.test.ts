/** @jest-environment node */
jest.mock("@/lib/openai", () => ({ MODEL: "test", getChatCompletion: jest.fn() }));
import { getChatCompletion } from "@/lib/openai";
import { translateTexts } from "@/lib/translateTexts";

const answer = (items: { id: number; text: string }[]) => (getChatCompletion as jest.Mock).mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(items) } }] });

describe("translating short labels", () => {
  it("keeps a skill a short name: a sentence or an explanation is dropped and the original stays", async () => {
    answer([
      { id: 0, text: "Trabajo en equipo" },
      { id: 1, text: "Capacidad para comunicarse de forma clara y efectiva con todos los miembros del equipo." },
      { id: 2, text: "Gestión de proyectos (incluye metodologías ágiles)" },
      { id: 3, text: "Resolución de problemas" },
    ]);
    const out = await translateTexts(["Teamwork", "Communication", "Project management", "Problem solving"], "es");
    expect(out).toEqual(["Trabajo en equipo", "Communication", "Project management", "Resolución de problemas"]);
  });

  it("matches each answer to its text by id, whatever the order", async () => {
    answer([{ id: 1, text: "Comunicación" }, { id: 0, text: "Liderazgo" }]);
    expect(await translateTexts(["Leadership", "Communication"], "es")).toEqual(["Liderazgo", "Comunicación"]);
  });
});
