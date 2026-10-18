// A resume that is a scan or a photo saved as a PDF has no text to read. The AI provider (Gemini) reads PDFs and images itself, so in that
// case the file is sent to it to be transcribed: it comes back as plain text, which then goes through the same reading as any other resume.
import { AI_API_KEY, AI_BASE_URL, AI_MODEL } from "@/lib/aiConfig";

const NATIVE = "https://generativelanguage.googleapis.com/v1beta";

/** True when the configured provider can read a PDF directly (Gemini's own API). */
export const canReadScans = () => Boolean(AI_API_KEY) && AI_BASE_URL.includes("generativelanguage.googleapis.com");

/** The text of a scanned PDF, as the provider reads it; "" when it cannot be read. */
export async function transcribePdf(pdf: Buffer): Promise<string> {
  if (!canReadScans()) return "";
  const res = await fetch(`${NATIVE}/models/${encodeURIComponent(AI_MODEL)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": AI_API_KEY as string },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: "application/pdf", data: pdf.toString("base64") } },
            {
              text: "Transcribe ALL the text of this document exactly as written, in its original language, in reading order (every column and section, top to bottom). Keep headings, dates, names, places and bullet points. Do not translate, summarize or add anything. Answer with the plain text only.",
            },
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 8192 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    console.error("Scan transcription failed", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return "";
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
}
