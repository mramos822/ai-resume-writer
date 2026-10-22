import { getChatCompletion, MODEL } from "@/lib/openai";

/** Translates the texts of a resume (a list of strings) into English or neutral Latin American Spanish, same order and length. Empty strings stay empty. Throws when the AI answer does not match. */
export async function translateTexts(texts: string[], target: "en" | "es"): Promise<string[]> {
    // empty strings stay empty and are not sent
    const idx = texts.map((t, i) => (t.trim() ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 0) return texts;

    const language = target === "es" ? 'neutral Latin American Spanish (use "tú", never "vos" or "vosotros"; "currículum")' : "natural American English";
    const completion = await getChatCompletion({
      model: MODEL,
      temperature: 0,
      max_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You translate the texts of a resume into ${language}. You receive a JSON array of strings and answer with ONLY a JSON array of the same length, in the same order, each item translated.
Rules: keep the resume voice (bullets start with an action verb, no personal pronouns, past tense for finished work); keep the PROPER names (companies, named schools and universities, products, software like Excel or MS-Office, programming languages like Python) as they are; keep numbers, percentages, currency and dates exactly; use the usual term of that country's job market for roles and degrees; never add or remove information. Everything else IS translated, even when it is a single word or a short label: skills ("Programmierung" becomes "Programming"), the names of spoken languages ("Spanisch" becomes "Spanish"), hobbies, degrees and fields of study ("Hochschulstudium: Systemtechnik" becomes "University degree: Systems engineering"), group names and certificate names. Never answer with the original item unless it really is the same word in the target language.`,
        },
        { role: "user", content: JSON.stringify(idx.map((i) => texts[i])) },
      ],
    });
    const raw = (completion.choices[0].message.content ?? "").replace(/^```json\s*|^```\s*|```$/gm, "").trim();
    const parsed = JSON.parse(raw.match(/\[[\s\S]*\]$/)?.[0] ?? "null") as unknown;
    if (!Array.isArray(parsed) || parsed.length !== idx.length) throw new Error("The translation did not match.");
    const out = [...texts];
    idx.forEach((i, n) => {
      const v = parsed[n];
      if (typeof v === "string" && v.trim()) out[i] = v.trim();
    });
    return out;
}
