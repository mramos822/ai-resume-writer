import { asResumeLang, langRule } from "@/lib/resumeLang";
import { limitedShared } from "@/lib/rateLimit";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { authUid, ownedProfile, ownedJobAd, errorResponse } from "@/lib/apiAuth";
import { db } from "@/lib/mongodb";
import { getOpenAIChatCompletionProgress } from "@/lib/openaiClient";
import { AI_MODEL_STRONG } from "@/lib/aiConfig";
import { basicReview, type ReviewResult } from "@/lib/resumeReview";
import { evaluateAuto } from "@/lib/reviewRubric";
import { RUBRIC_VERSION, cleanPrevious, interpretAi, reviewPayload, reviewSystemPrompt } from "@/lib/reviewEngine";
import { measure, loadRoleProfile } from "@/lib/reviewServer";
import { targetRoleOf } from "@/lib/roleProfile";
import type { ProfileData } from "@/context/profileContext";

export async function POST(req: Request) {
  const tooMany = await limitedShared(req, "ai", 40, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    const uid = await authUid(req);
    const body = await req.json();
    const { profileId } = body;
    const template = typeof body.template === "string" ? body.template : "classic";
    const lang = asResumeLang(body.lang);
    if (!profileId || typeof profileId !== "string") {
      return NextResponse.json({ error: "Profile not provided." }, { status: 400 });
    }
    const profile = await ownedProfile(uid, profileId);
    const data = {
      ...(profile.data as ProfileData),
      name: (profile.data as ProfileData)?.name || (/^Profile \d+$/.test(profile.name) ? "John Doe" : profile.name),
    } as ProfileData;

    const run = (report: (percent: number) => void) => review(uid, profileId, data, template, lang, body, report);
    // the progress is sent while it happens when the screen asks for it; otherwise the answer comes as one JSON
    if (body.stream !== true) return NextResponse.json(hideRubric(await run(() => {})));
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(controller) {
          const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
          let last = 0;
          try {
            const result = await run((p) => {
              const v = Math.round(Math.min(99, Math.max(last, p)));
              if (v > last) {
                last = v;
                send({ p: v });
              }
            });
            send({ done: true, result: hideRubric(result) });
          } catch (err) {
            const res = errorResponse(err, "We couldn't review your resume.");
            send({ error: (await res.json().catch(() => ({}))).error ?? "We couldn't review your resume.", status: res.status });
          }
          controller.close();
        },
      }),
      { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } }
    );
  } catch (err) {
    return errorResponse(err, "We couldn't review your resume.");
  }
}

/** About how many characters the AI writes for a review: the bar fills as the answer arrives. */
const EXPECTED_CHARS = 2600;

async function review(
  uid: string,
  profileId: string,
  data: ProfileData,
  template: string,
  lang: ReturnType<typeof asResumeLang>,
  body: { jobAdId?: unknown; previous?: unknown },
  report: (percent: number) => void
): Promise<ReviewResult> {
    // What is the resume judged against? By default a GENERAL standard for the role (a resume made from scratch).
    // When a job posting is given (job alerts), its requirements are used instead.
    let ad: { id: string; title: string; text: string } | undefined;
    if (typeof body.jobAdId === "string" && body.jobAdId) {
      const doc = await ownedJobAd(uid, body.jobAdId);
      const text = String(doc.rawText || doc.previewHtml || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
      if (text) ad = { id: body.jobAdId, title: String(doc.jobTitle || "this job"), text };
    }
    report(8);
    const role = await loadRoleProfile(targetRoleOf(data), ad);
    report(30);

    // how the resume fits its page with the look the person picked (the same renderer that makes the PDF)
    const fit = await measure(data, template, lang);
    report(38);
    const auto = evaluateAuto(data, fit, template, role);

    // The same resume always gets the same review: results are cached by the content that was judged
    const previous = cleanPrevious(body.previous);
    const hash = createHash("sha256")
      // the previous review is part of what was judged: the result is kept steady against it, so another "previous" is another review
      .update(JSON.stringify({ v: RUBRIC_VERSION, model: AI_MODEL_STRONG, lang, template, fit, role, previous: previous ? { v: previous.verdicts, a: previous.appliedCriteria } : null, resume: reviewPayload(data, { template, fit, role }, auto).resume }))
      .digest("hex");
    const cache = db.collection("resumeReviews");
    const hit = await cache.findOne<{ result: ReviewResult }>({ profileId, hash }).catch(() => null);
    if (hit?.result) return hit.result;

    try {
      const completion = await getOpenAIChatCompletionProgress({
        model: AI_MODEL_STRONG,
        temperature: 0,
        max_tokens: 7000,
        messages: [
          { role: "system", content: reviewSystemPrompt() + langRule(lang, "the headline, the strengths and every issue title and detail") },
          { role: "user", content: JSON.stringify(reviewPayload(data, { template, fit, previous, role }, auto)) },
        ],
      }, { timeout: 40_000, maxRetries: 0 }, (chars) => report(38 + 52 * Math.min(1, chars / EXPECTED_CHARS))); // a slow AI must not leave the person waiting: the fallback answers
      let raw: unknown = null;
      try {
        raw = JSON.parse(completion.content);
      } catch {
        raw = null;
      }
      report(92);
      const reviewed = await interpretAi(raw, data, { template, fit, previous, role }, (patched) => measure(patched, template, lang));
      if (reviewed) {
        await cache.updateOne({ profileId, hash }, { $set: { profileId, hash, result: reviewed, createdAt: new Date() } }, { upsert: true }).catch(() => {});
        return reviewed;
      }
      console.error("Resume review: the AI reply could not be used");
    } catch (err) {
      console.error("Resume review: AI call failed", err);
    }
    // The AI is unavailable or answered with something unusable: the measurable guidelines still give a stable review
    return basicReview(data, fit, template, role);
}

/**
 * What the client gets does not include how the score is made: no weights, no guideline text, no per-guideline reasons.
 * Showing the exact rubric would let anyone paste it into any AI and skip the review. The client only needs each
 * guideline's id and verdict (to tell what changed between two reviews).
 */
function hideRubric<T extends { criteria?: unknown[] }>(review: T): T {
  const full = (review.criteria ?? []) as { id: string; verdict: string; earned?: number; weight?: number }[];
  const criteria = full.map(({ id, verdict }) => ({ id, verdict }));
  // only the totals of everything but the layout guideline: enough to re-score when the look changes, not to read the weights
  const others = full.filter((c) => c.id !== "atsLayout");
  const atsRest = { earned: others.reduce((n, c) => n + (c.earned ?? 0), 0), total: others.reduce((n, c) => n + (c.weight ?? 0), 0) };
  return { ...review, criteria, atsRest };
}
