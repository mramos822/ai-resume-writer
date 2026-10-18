/** @jest-environment node */
import { detectLanguage } from "@/lib/ingest/language";

const EN = "We are looking for a Backend Engineer to join our platform team. You will design and build services, work with product and design, and take ownership of the systems you ship. You have 5 years of experience with Python and a strong sense of quality.";
const ES = "Buscamos un ingeniero de software para unirse a nuestro equipo de plataforma. Serás responsable de diseñar los servicios y trabajarás con el equipo de producto. Tienes experiencia con Python y una gran capacidad para el trabajo en equipo.";
const FR = "FR - Réceptionniste (H/F/X). La première impression est toujours la bonne! En tant que Réceptionniste, vous prenez soin de nos clients depuis leur arrivée jusqu'à leur départ, et vous travaillez avec une équipe dans notre hôtel. Votre expérience est un atout pour ce poste.";
const DE = "Wir suchen einen Softwareentwickler für unser Team. Ihre Aufgaben sind die Entwicklung von Services und die Zusammenarbeit mit dem Produktteam. Sie haben Erfahrung mit Python und eine strukturierte Arbeitsweise, und Sie sind bereit, die Verantwortung für Ihre Systeme zu übernehmen.";
const PT = "Procuramos um engenheiro de software para a nossa equipe. Você será responsável por desenhar os serviços e trabalhará com o time de produto. Você tem experiência com Python e não tem medo de assumir a responsabilidade pelos sistemas que entrega.";
const IT = "Cerchiamo un ingegnere software per la nostra squadra. Sarete responsabili della progettazione dei servizi e lavorerete con il team di prodotto. Avete esperienza con Python e siete pronti a prendervi la responsabilità dei sistemi che consegnate.";

describe("language of a posting", () => {
  it("knows each language it is asked about", () => {
    expect(detectLanguage(EN)).toBe("en");
    expect(detectLanguage(ES)).toBe("es");
    expect(detectLanguage(FR)).toBe("fr");
    expect(detectLanguage(DE)).toBe("de");
    expect(detectLanguage(PT)).toBe("pt");
    expect(detectLanguage(IT)).toBe("it");
  });

  it("counts a doubt as English, so a job is never hidden by mistake", () => {
    expect(detectLanguage("")).toBe("en");
    expect(detectLanguage("Senior Developer")).toBe("en");
    expect(detectLanguage("Python, Kubernetes, AWS, Terraform, PostgreSQL, Redis, Kafka, gRPC")).toBe("en");
    expect(detectLanguage("Ingeniero de software")).toBe("en"); // too short to be sure
  });

  it("keeps an English posting that names a Spanish-speaking market in English", () => {
    expect(detectLanguage("We are hiring in Mexico City: the team will work with clients in Latin America, and you will be responsible for the sales of our products with your experience in the region.")).toBe("en");
  });
});
