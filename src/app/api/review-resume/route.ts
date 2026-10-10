import { limited } from "@/lib/rateLimit";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { authUid, ownedProfile, ownedJobAd, errorResponse } from "@/lib/apiAuth";
import { db } from "@/lib/mongodb";
import { getOpenAIChatCompletion } from "@/lib/openaiClient";
import { AI_MODEL } from "@/lib/aiConfig";
import { basicReview, type ReviewResult } from "@/lib/resumeReview";
import { evaluateAuto } from "@/lib/reviewRubric";
import { RUBRIC_VERSION, cleanPrevious, interpretAi, reviewPayload, reviewSystemPrompt } from "@/lib/reviewEngine";
import { measure, loadRoleProfile } from "@/lib/reviewServer";
import { targetRoleOf } from "@/lib/roleProfile";
import type { ProfileData } from "@/context/profileContext";

export async function POST(req: Request) {
  const tooMany = limited(req, "ai", 40, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    const uid = await authUid(req);
    const body = await req.json();
    const { profileId } = body;
    const template = typeof body.template === "string" ? body.template : "classic";
    if (!profileId || typeof profileId !== "string") {
      return NextResponse.json({ error: "Profile not provided." }, { status: 400 });
    }
    const profile = await ownedProfile(uid, profileId);
    const data = {
      ...(profile.data as ProfileData),
      name: (profile.data as ProfileData)?.name || (/^Profile \d+$/.test(profile.name) ? "John Doe" : profile.name),
    } as ProfileData;

    // What is the resume judged against? By default a GENERAL standard for the role (a resume made from scratch).
    // When a job posting is given (job alerts), its requirements are used instead.
    let ad: { id: string; title: string; text: string } | undefined;
    if (typeof body.jobAdId === "string" && body.jobAdId) {
      const doc = await ownedJobAd(uid, body.jobAdId);
      const text = String(doc.rawText || doc.previewHtml || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
      if (text) ad = { id: body.jobAdId, title: String(doc.jobTitle || "this job"), text };
    }
    const role = await loadRoleProfile(targetRoleOf(data), ad);

    // how the resume fits its page with the look the person picked (the same renderer that makes the PDF)
    const fit = await measure(data, template);
    const auto = evaluateAuto(data, fit, template, role);

    // The same resume always gets the same review: results are cached by the content that was judged
    const previous = cleanPrevious(body.previous);
    const hash = createHash("sha256")
      .update(JSON.stringify({ v: RUBRIC_VERSION, model: AI_MODEL, template, fit, role, resume: reviewPayload(data, { template, fit, role }, auto).resume }))
      .digest("hex");
    const cache = db.collection("resumeReviews");
    const hit = await cache.findOne<{ result: ReviewResult }>({ profileId, hash }).catch(() => null);
    if (hit?.result) return NextResponse.json(hit.result);

    try {
      const completion = await getOpenAIChatCompletion({
        model: AI_MODEL,
        temperature: 0,
        max_tokens: 3500,
        messages: [
          { role: "system", content: reviewSystemPrompt() },
          { role: "user", content: JSON.stringify(reviewPayload(data, { template, fit, previous, role }, auto)) },
        ],
      });
      let raw: unknown = null;
      try {
        raw = JSON.parse(completion.content);
      } catch {
        raw = null;
      }
      const reviewed = await interpretAi(raw, data, { template, fit, previous, role }, (patched) => measure(patched, template));
      if (reviewed) {
        await cache.updateOne({ profileId, hash }, { $set: { profileId, hash, result: reviewed, createdAt: new Date() } }, { upsert: true }).catch(() => {});
        return NextResponse.json(reviewed);
      }
      console.error("Resume review: the AI reply could not be used");
    } catch (err) {
      console.error("Resume review: AI call failed", err);
    }
    // The AI is unavailable or answered with something unusable: the measurable guidelines still give a stable review
    return NextResponse.json(basicReview(data, fit, template, role));
  } catch (err) {
    return errorResponse(err, "We couldn't review your resume.");
  }
}
