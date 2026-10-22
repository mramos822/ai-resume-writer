import { getChatCompletion, MODEL } from "@/lib/openai";

/** Translates the texts of a resume (a list of strings) into English or neutral Latin American Spanish, same order and length. Empty strings stay empty. Throws when the AI answer does not match. */
export async function translateTexts(texts: string[], target: "en" | "es"): Promise<string[]> {
    // empty strings stay empty and are not sent
    const idx = texts.map((t, i) => (t.trim() ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 0) return texts;

    const language = target === "es" ? 'neutral Latin American Spanish (use "tú", never "vos" or "vosotros"; "currículum")' : "natural American English";
    const out = [...texts];
    // small groups: the AI keeps each text with its own answer much better than with a list of hundreds
    const groups: number[][] = [];
    for (let k = 0; k < idx.length; k += 40) groups.push(idx.slice(k, k + 40));
    await Promise.all(groups.map(async (group) => {
    const completion = await getChatCompletion({
      model: MODEL,
      temperature: 0,
      max_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You translate the texts of a resume into ${language}. You receive a JSON array of objects {"id": number, "text": string} and answer with ONLY a JSON array of objects {"id": number, "text": string}: one for each item received, with the SAME id and the text translated. Never change, skip, repeat or invent an id.
Your job is ONLY to translate: a faithful, literal translation, item by item. Do NOT rewrite, improve, shorten, expand, summarise, reorder, merge or split anything, and never add or remove information. Each answer must say exactly what its original says, with about the same length and the same structure (a skill stays a short skill, a bullet stays a bullet, a title stays a title). Keep the resume voice only as far as the original already has it. Keep unchanged: PROPER names (companies, named schools and universities, products), software, tools, frameworks, libraries, platforms, protocols and programming languages (Excel, MS-Office, Python, React, Node.js, SQL, Git, Docker, AWS, Agile, Scrum...), acronyms, numbers, percentages, currency and dates. Translate everything else, even a single word or a short label: general skills ("Problem solving" becomes its usual equivalent), the names of spoken languages, hobbies, degrees and fields of study, group names, certificate names, job titles. A short item (a skill, a language, a hobby, a title, a label of one to four words) is a NAME, not a sentence: translate it to a short name with at most one word more than the original, and NEVER to a sentence, an explanation, a clarification or a text in parentheses (do not add context that the original does not have). If an item is already in the target language, or is a name that should not be translated, answer with it unchanged.`,
        },
        { role: "user", content: JSON.stringify(group.map((i) => ({ id: i, text: texts[i] }))) },
      ],
    });
    const raw = (completion.choices[0].message.content ?? "").replace(/^```json\s*|^```\s*|```$/gm, "").trim();
    const parsed = JSON.parse(raw.match(/\[[\s\S]*\]$/)?.[0] ?? "null") as unknown;
    if (!Array.isArray(parsed)) throw new Error("The translation did not match.");
    // every answer is matched to its text by its id (never by its position), so one that is skipped or repeated cannot move the others
    for (const item of parsed as { id?: unknown; text?: unknown }[]) {
      const i = typeof item?.id === "number" ? item.id : -1;
      if (!group.includes(i) || typeof item.text !== "string" || !item.text.trim()) continue;
      const t = item.text.trim();
      const o = texts[i].trim();
      // a translation says what the original says with about the same length: one that grew or shrank a lot is the AI writing something else
      // (a rewritten skill, an invented sentence), so the original is kept for that item
      const words = (x: string) => x.split(/\s+/).filter(Boolean).length;
      const isLabel = words(o) <= 4 && !/[.;:!?]/.test(o); // a skill, a language, a hobby, a title: a name, not a sentence
      const drifted =
        t.length > o.length * 2 + 15 ||
        (o.length > 12 && t.length < o.length * 0.35) ||
        // a name has to stay a name: about as many words, and without the punctuation of a sentence or an aside that the original does not have
        (isLabel && (words(t) > words(o) + 2 || t.length > o.length * 2 + 6 || (/[.;:!?()]/.test(t) && !/[.;:!?()]/.test(o)) || (t.includes(",") && !o.includes(","))));
      if (!drifted) out[i] = t;
    }
    }));
    return out;
}
