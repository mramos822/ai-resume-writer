import { createHash } from "crypto";
import { db } from "@/lib/mongodb";
import { getOpenAIChatCompletion } from "@/lib/openaiClient";
import { AI_MODEL } from "@/lib/aiConfig";
import type { PageFit } from "@/lib/reviewRubric";
import { RUBRIC_VERSION } from "@/lib/reviewEngine";
import { renderResumeDetailed } from "@/lib/pdfResume";
import { ROLE_PROFILE_SYSTEM, cleanRoleProfile, roleKey, type RoleProfile } from "@/lib/roleProfile";
import type { ProfileData } from "@/context/profileContext";

export async function measure(p: ProfileData, template: string): Promise<PageFit | null> {
  try {
    const r = await renderResumeDetailed(p, template);
    return { pages: r.pages, scale: r.scale };
  } catch (err) {
    console.error("Resume review: could not measure the page fit", err);
    return null;
  }
}

/**
 * The professional rubric of the role, written once by the AI and then reused (so every review of that role uses the
 * same standard). With a job posting it describes that one posting instead of a general resume for the role.
 */
export async function loadRoleProfile(role: string, ad?: { id: string; title: string; text: string }): Promise<RoleProfile | null> {
  if (!ad && !role) return null;
  const key = ad ? `ad:${ad.id}:${createHash("sha1").update(ad.text).digest("hex").slice(0, 12)}` : roleKey(role);
  const col = db.collection("roleProfiles");
  const hit = await col.findOne<{ profile: RoleProfile }>({ key, v: RUBRIC_VERSION }).catch(() => null);
  if (hit?.profile) return hit.profile;
  try {
    const completion = await getOpenAIChatCompletion({
      model: AI_MODEL,
      temperature: 0,
      max_tokens: 1200,
      messages: [
        { role: "system", content: ROLE_PROFILE_SYSTEM },
        { role: "user", content: ad ? `Job posting for "${ad.title}":\n${ad.text}` : `Role: ${role}` },
      ],
    });
    const profile = cleanRoleProfile(JSON.parse(completion.content), ad?.title || role, ad ? "job-ad" : "general");
    if (profile) {
      await col.updateOne({ key, v: RUBRIC_VERSION }, { $set: { key, v: RUBRIC_VERSION, profile, createdAt: new Date() } }, { upsert: true }).catch(() => {});
      return profile;
    }
  } catch (err) {
    console.error("Resume review: could not build the role profile", err);
  }
  return null;
}

