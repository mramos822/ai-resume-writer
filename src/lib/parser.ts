// src/lib/parser.ts
import mammoth            from "mammoth";
import OpenAI             from "openai";
import type { ProfileData } from "@/context/profileContext";

import { AI_API_KEY, AI_BASE_URL, AI_MODEL } from "@/lib/aiConfig";

if (!AI_API_KEY) {
  throw new Error("Missing AI_API_KEY");
}

const client = new OpenAI({ apiKey: AI_API_KEY, baseURL: AI_BASE_URL, timeout: 60_000 });
const MODEL  = AI_MODEL;

/** 
 * Given a Buffer and its MIME type, extract text (PDF/Word/plain),
 * call the configured AI model to parse into JSON, and return a Partial<ProfileData>.
 */
export async function parseBufferToProfileData(
  buffer: Buffer,
  contentType: string
): Promise<Partial<ProfileData>> {
  // 1) extract raw text
  let text: string;
  if (contentType === "application/pdf") {
    // dynamic import after stubbing in your route
    const { default: pdfParse } = await import("pdf-parse");
    text = (await pdfParse(buffer)).text;
  } else if (
    contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    text = (await mammoth.extractRawText({ buffer })).value;
  } else {
    text = buffer.toString("utf-8");
  }

  // 2) craft a JSON-only system prompt
  const systemPrompt = `
You are an expert resume parser.
Respond with NOTHING but a single, valid JSON object matching this interface exactly:

interface ProfileData {
  contactInfo: { email: string; phone: string; address: string; additionalEmails?: string[]; additionalPhones?: string[] };
  careerObjective: string;
  skills: string[];
  jobHistory: { company: string; title: string; description: string; startDate: string; endDate: string; current: boolean; accomplishments: string[] }[];
  education: { school: string; degree: string; startDate: string; endDate: string; current: boolean; gpa?: string }[];
  internships: { company: string; title: string; description: string; startDate: string; endDate: string; current: boolean; accomplishments: string[] }[];
  projects: { name: string; description: string; link?: string; technologies: string[]; startDate: string; endDate: string; current: boolean; accomplishments: string[] }[];
}

"internships" is ONLY for formal internships or co-ops at a company. Personal, academic, hackathon, open-source or side projects go in "projects", never in "internships" or "jobHistory".

Output only the JSON, no explanation.
  `.trim();

  // 3) call the model
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    top_p: 1,
    max_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: text },
    ],
  });

  const raw = res.choices[0].message.content ?? "";
  const match = raw.match(/\{[\s\S]*\}$/);
  if (!match) {
    throw new Error("No JSON object found in AI response");
  }

  // 4) parse it
  return JSON.parse(match[0]) as Partial<ProfileData>;
}
