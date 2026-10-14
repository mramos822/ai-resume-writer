import type { ProfileData } from "@/context/profileContext";
import { authFetch } from "@/lib/authFetch";
import { applyTexts, translatableTexts, type ResumeLanguage } from "@/lib/resumeTranslate";

/** The profile with its texts translated (company names, schools, tools and dates stay as they are). */
export async function translateProfile(data: Partial<ProfileData>, target: ResumeLanguage): Promise<Partial<ProfileData>> {
  const res = await authFetch("/api/translate-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: translatableTexts(data), target }),
  });
  const body = (await res.json().catch(() => ({}))) as { texts?: string[]; error?: string };
  if (!res.ok || !Array.isArray(body.texts)) throw new Error(body.error || "We couldn't translate your resume right now.");
  return applyTexts(data, body.texts);
}
