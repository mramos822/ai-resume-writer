import { applyTexts, detectResumeLanguage, translatableTexts } from "@/lib/resumeTranslate";
import type { ProfileData } from "@/context/profileContext";

const base = {
  jobTitle: "Software Engineer",
  careerObjective: "Engineer who builds and ships web applications with a focus on reliability and the people who use them.",
  skills: ["Teamwork", "React"],
  skillLevels: { Teamwork: 4 },
  skillGroups: { Teamwork: "Soft skills" },
  jobHistory: [{ id: "j1", company: "Acme", title: "Developer", description: "", startDate: "2020-01", endDate: "", current: true, accomplishments: ["Led a team of five engineers and reduced the deploy time by 40% across all services."] }],
  education: [],
  internships: [],
  projects: [],
} as unknown as Partial<ProfileData>;

describe("resume language", () => {
  it("detects English and Spanish", () => {
    expect(detectResumeLanguage(base)).toBe("en");
    const es = {
      ...base,
      careerObjective: "Ingeniero que desarrolla y lanza aplicaciones web con un enfoque en la confiabilidad y en las personas que las usan todos los días.",
      jobHistory: [{ ...(base.jobHistory![0]), accomplishments: ["Lideré un equipo de cinco ingenieros y reduje el tiempo de despliegue en un 40% en todos los servicios de la empresa."] }],
    } as Partial<ProfileData>;
    expect(detectResumeLanguage(es)).toBe("es");
  });
  it("does not guess when there is little text", () => {
    expect(detectResumeLanguage({ jobTitle: "Cook", skills: [] } as unknown as Partial<ProfileData>)).toBeNull();
  });
  it("puts translations back and keeps the level of a renamed skill", () => {
    const texts = translatableTexts(base);
    const t = texts.map((x) => (x === "Teamwork" ? "Trabajo en equipo" : x === "Developer" ? "Desarrollador" : x));
    const out = applyTexts(base, t);
    expect(out.jobHistory![0].title).toBe("Desarrollador");
    expect(out.skills).toEqual(["Trabajo en equipo", "React"]);
    expect(out.skillLevels).toEqual({ "Trabajo en equipo": 4 });
    expect(out.skillGroups).toEqual({ "Trabajo en equipo": "Soft skills" });
  });
});

describe("detectOtherLanguage", () => {
  const mk = (s: string) => ({ jobTitle: "x", careerObjective: s, skills: [] }) as unknown as Partial<ProfileData>;
  const { detectOtherLanguage } = jest.requireActual("@/lib/resumeTranslate") as typeof import("@/lib/resumeTranslate");
  it("recognizes German", () => {
    expect(detectOtherLanguage(mk("Erfahrene Projektleiterin mit mehr als zehn Jahren Erfahrung in der Leitung von Teams und der Einführung neuer Prozesse für Kunden in der Industrie, mit Schwerpunkt auf Qualität und Kommunikation."))).toBe("German");
  });
  it("recognizes French", () => {
    expect(detectOtherLanguage(mk("Ingénieure expérimentée avec plus de dix ans d'expérience dans la gestion de projets et des équipes pour des clients de l'industrie, avec un accent sur la qualité et la communication dans les services."))).toBe("French");
  });
  it("recognizes another script", () => {
    expect(detectOtherLanguage(mk("Опытный руководитель проектов с более чем десятилетним стажем управления командами и внедрения новых процессов для клиентов."))).toBe("another language");
  });
  it("leaves English and Spanish alone", () => {
    expect(detectOtherLanguage(mk("Experienced project manager with more than ten years of leading teams and introducing new processes for clients in the industry, with a focus on quality and communication."))).toBeNull();
    expect(detectOtherLanguage(mk("Gerente de proyectos con más de diez años de experiencia dirigiendo equipos y poniendo en marcha nuevos procesos para clientes de la industria, con enfoque en la calidad y la comunicación."))).toBeNull();
  });
});

describe("the whole profile is translated", () => {
  it("covers skills, groups, languages, interests and certificates, in the same order it puts them back", () => {
    const p = {
      jobTitle: "Kellner",
      skills: ["Programmierung"],
      skillGroups: { Programmierung: "IT-Kenntnisse" },
      skillLevels: { Programmierung: 3 },
      languages: [{ name: "Spanisch", level: "Native" }],
      interests: ["Fussball spielen"],
      certifications: [{ name: "Erste Hilfe", issuer: "DRK", year: "2020" }],
    } as unknown as Partial<ProfileData>;
    const texts = translatableTexts(p);
    expect(texts).toEqual(expect.arrayContaining(["Programmierung", "IT-Kenntnisse", "Spanisch", "Fussball spielen", "Erste Hilfe"]));
    const out = applyTexts(p, texts.map((t) => `EN:${t}`));
    expect(out.interests).toEqual(["EN:Fussball spielen"]);
    expect(out.languages?.[0].name).toBe("EN:Spanisch");
    expect(out.certifications?.[0].name).toBe("EN:Erste Hilfe");
    expect(out.skills).toEqual(["EN:Programmierung"]);
    expect(out.skillGroups).toEqual({ "EN:Programmierung": "EN:IT-Kenntnisse" });
    expect(out.skillLevels).toEqual({ "EN:Programmierung": 3 });
  });
});
