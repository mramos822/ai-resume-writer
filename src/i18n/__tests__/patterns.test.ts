import { makeT } from "@/i18n/translate";

describe("Spanish for the sentences the review makes", () => {
    const { trd } = makeT("es");

    it("translates a sentence with numbers in it", () => {
        expect(trd("12 skills.")).toBe("12 habilidades.");
        expect(trd("3 of your 12 skills also show up in your experience, projects or studies.")).toContain("3 de tus 12 habilidades");
        expect(trd("Missing: phone, location.")).toBe("Falta: teléfono, ubicación.");
    });

    it("translates a text made of several sentences", () => {
        expect(trd("Add numbers. 40% of your recent bullets contain a number.")).toContain("El 40 % de tus viñetas recientes");
    });

    it("leaves English alone in English and unknown text as it is", () => {
        expect(makeT("en").trd("12 skills.")).toBe("12 skills.");
        expect(trd("Something nobody wrote down.")).toBe("Something nobody wrote down.");
    });
});
