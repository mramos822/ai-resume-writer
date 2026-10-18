// Reading a resume file: cleaning the text that comes out of a PDF or Word file, getting the JSON out of the AI's answer, and the
// instructions that let the AI read a resume written in any language.

/** The text of a file made ready for the AI: composed accents (PDFs often split "ü" into "u" + a mark), no ligatures or soft hyphens. */
export function cleanExtractedText(text: string): string {
  return text
    .normalize("NFKC") // composes accents and turns ligatures (ﬁ, ﬂ) and odd spaces into plain characters
    .replace(/­/g, "") // soft hyphens
    .replace(/[​-‍﻿]/g, "") // invisible characters
    .replace(/-\n(?=\p{Ll})/gu, "") // a word broken at the end of a line ("Berufs-\nerfahrung")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Less than this and the file has no text we can read (a scan or an image): there is nothing to send to the AI. */
export const MIN_READABLE_CHARS = 40;

/** The JSON object of an AI answer, even when it comes with code fences or a sentence before or after it. */
export function extractJsonObject(raw: string): string | null {
  const text = raw.replace(/```(?:json)?/gi, "");
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  return a >= 0 && b > a ? text.slice(a, b + 1) : null;
}

/** Parses the AI's JSON; small slips (a comma before a closing bracket) are forgiven, anything else throws. */
export function parseAiJson<T>(json: string): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return JSON.parse(json.replace(/,\s*([}\]])/g, "$1")) as T;
  }
}

/** Added to the instructions of the resume readers: the resume may be in any language, and the data comes out in that same language. */
export const ANY_LANGUAGE_RULES = `
The resume can be written in ANY language (German, French, Italian, Portuguese, Spanish, Dutch, Polish, Turkish, Russian, Japanese, Chinese, Arabic, English...). Read it in its own language and do not translate anything: copy names, companies, schools, job titles and bullets exactly as written.
Understand the headings in any language: "Berufserfahrung", "Expérience professionnelle", "Esperienza lavorativa", "Experiência", "Experiencia" = work history; "Ausbildung", "Studium", "Formation", "Istruzione", "Educação" = education; "Kenntnisse", "Fähigkeiten", "Compétences", "Competenze", "Habilidades" = skills; "Sprachen", "Langues", "Lingue", "Idiomas" = spoken languages; "Persönliche Daten", "Profil", "Über mich", "Profilo" = personal details and summary.
Current position: "heute", "bis heute", "jetzt", "derzeit", "aktuell", "laufend", "présent", "en cours", "oggi", "attuale", "atual", "actualidad", "presente" mean the person still works or studies there (current true, endDate "").
Dates: "03/2019", "03.2019", "März 2019", "mars 2019", "marzo 2019" all become "2019-03"; a lone year "2019" becomes "2019-01" for a start and "2019-12" for an end.
Education: every school period is one education entry, also a secondary school ("Schulbildung", "Abitur", "Realschule", "Gymnasium", "école", "liceo", "colegio"). A period written as "2007-2021" gives startDate "2007-01" and endDate "2021-12" (the school or degree is completed when the text says "abgeschlossen", "erfolgreich beendet", "diplômé", "laureato" or simply gives an end year); "2022-Jetzt" is still in progress (current true, endDate ""). A line like "Hochschulstudium: Systemtechnik", "Studium: ...", "Studiengang ...", "Bachelor ...", "Licence ..." or "Laurea ..." is the university degree: put the field of study in "degree" ("Systemtechnik") together with the level when it is written (Bachelor, Master, Diplom), and the university in "school". Never leave "degree" empty when the resume names a field or level of study.
Resumes copied from a website or an online editor come with its menus, buttons, ads, job offers and footers around the resume: ignore all of that and read only the resume itself.
A single section can mix several kinds of data under small labels, for example "KENNTNISSE UND INTERESSEN" with "Fremdsprachen Spanisch (Muttersprache) Englisch (C1) Deutsch (A2)", "IT-Kenntnisse Programmierung und MS-Office kentnisse", "Hobbys Fussball spielen und Gitarre spielen". Split it by those labels: the spoken languages ("Fremdsprachen", "Sprachen", "Langues", "Idiomas", "Lingue") go to "languages" (EVERY language listed, one entry each, with its level); the computer or professional knowledge ("IT-Kenntnisse", "EDV-Kenntnisse", "Kenntnisse", "Compétences", "Competenze") goes to "skills" as separate short items ("Programmierung", "MS-Office"); the hobbies ("Hobbys", "Interessen", "Loisirs", "Hobby", "Aficiones") go to "interests", one entry per hobby, splitting "A und B" or "A and B" into two. Fix obvious typos in what you copy ("kentnisse" is "Kenntnisse").
Levels written as a CEFR level: A1 and A2 = Basic, B1 = Intermediate, B2 = Advanced, C1 = Advanced, C2 = Fluent; "Muttersprache" = Native. Never drop a language because its level is written as a letter and a number.
Language levels: "Muttersprache", "langue maternelle", "madrelingua", "língua materna" = Native; "fließend", "verhandlungssicher", "courant", "fluente" = Fluent; "gute Kenntnisse", "bon niveau", "buono" = Advanced; "Grundkenntnisse", "notions", "base", "básico" = Basic.
`;
