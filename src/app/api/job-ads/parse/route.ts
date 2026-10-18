// src/app/api/job-ads/parse/route.ts
import { limitedShared } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { getChatCompletion, MODEL } from "@/lib/openai";
import { db } from '@/lib/mongodb';
import crypto from 'crypto';
import { fetchJobAdText, JOB_AD_LINK_ERROR } from "@/lib/jobAdText";
import { authUid, errorResponse } from "@/lib/apiAuth";

interface ParseRequest {
  url?: string;
  rawText?: string;
}

interface ParsedJob {
  jobTitle: string;
  companyName: string;
  postedAt: string;
  description: string;
  requirements: string[];
  location?: string;
  [key: string]: unknown;
}

const SYSTEM_PROMPT = `
You are an expert recruiter assistant.  Given the full text of a job posting, extract and return EXACTLY the following JSON shape, with no extra keys or commentary:

{
  "jobTitle": string,
  "companyName": string,
  "postedAt": string,         // e.g. "2023-09-30"
  "location": string,         // if available
  "description": string,      // a concise paragraph
  "requirements": string[]    // bullet points
}
`;

export async function POST(request: Request) {
  const tooMany = await limitedShared(request, "ai", 40, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    await authUid(request);
  } catch (err) {
    return errorResponse(err);
  }
  let body: ParseRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  let textSource = body.rawText || "";
  if (!textSource && body.url) {
    textSource = (await fetchJobAdText(body.url)) ?? "";
    if (!textSource) {
      return NextResponse.json({ error: JOB_AD_LINK_ERROR }, { status: 422 });
    }
  }
  if (!textSource) {
    return NextResponse.json(
      { error: "Must provide url or rawText" },
      { status: 400 }
    );
  }

  // Caching: hash the input
  const cacheKey = crypto.createHash('sha256').update('v2:' + new Date().toISOString().slice(0, 10) + textSource).digest('hex');
  const cacheColl = db.collection('ai_jobad_parse_cache');
  const cached = await cacheColl.findOne({ key: cacheKey });
  if (cached && cached.result) {
    return NextResponse.json(cached.result);
  }

  // call OpenAI
  let content = "";
  try {
    const aiResponse = await getChatCompletion({
      model: MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT.trim()}

Today is ${new Date().toISOString().slice(0, 10)}. Convert relative dates like "4 days ago" using today's date. Never invent a date: use an empty string if none is given.`,
        },
        { role: "user", content: textSource },
      ],
    });
    content = aiResponse.content ?? "";
  } catch (error: unknown) {
    if (
      typeof error === 'object' && error !== null &&
      ('code' in error || 'status' in error)
    ) {
      const err = error as { code?: string; status?: number; message?: string };
      if (err.code === 'RateLimitReached' || err.status === 429) {
        return NextResponse.json(
          { error: "OpenAI API rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Failed to call AI API", details: err.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to call AI API", details: String(error) },
      { status: 500 }
    );
  }

  // extract the JSON block
  const match = content.match(/\{[\s\S]*\}$/);
  if (!match) {
    return NextResponse.json(
      { error: "AI did not return valid JSON", raw: content },
      { status: 502 }
    );
  }

  try {
    const parsed = JSON.parse(match[0]) as ParsedJob;
    // Cache the result
    await cacheColl.insertOne({ key: cacheKey, result: parsed, createdAt: new Date() });
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse JSON", raw: match[0] },
      { status: 502 }
    );
  }
}
