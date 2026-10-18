/** @jest-environment node */
jest.mock("@/lib/openaiClient", () => ({ getOpenAIChatCompletion: jest.fn() }));
jest.mock("@/lib/aiConfig", () => ({ AI_MODEL: "test" }));

import { looksLikeJobList } from "@/lib/jobDigest";

describe("a link that is a list of jobs and not one posting", () => {
  it("knows the company and search pages of Computrabajo, and not one offer", () => {
    expect(looksLikeJobList("https://pe.computrabajo.com/empresas/ofertas-de-trabajo-de-qreps-selecciona-FD65FF1729C877A8", "x")).toBe(true);
    expect(looksLikeJobList("https://cl.computrabajo.com/trabajo-de-desarrollador", "x")).toBe(true);
    expect(looksLikeJobList("https://pe.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-de-asistente-de-monitoreo-gps-en-ate-2996F277466F7DA5", "Asistente de monitoreo GPS\nEn QREPS buscamos...")).toBe(false);
  });

  it("knows a text that begins by counting its offers", () => {
    expect(looksLikeJobList("https://example.com/jobs", "35 Ofertas de trabajo en QREPS SELECCIONA | Oferta Laboral Computrabajo")).toBe(true);
    expect(looksLikeJobList("https://example.com/jobs", "120 jobs in New Jersey")).toBe(true);
    expect(looksLikeJobList("https://example.com/job/1", "Software Engineer at Acme. We are looking for 3 years of experience.")).toBe(false);
  });
});
