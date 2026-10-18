// src/app/api/job-ads/route.ts
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import admin from "firebase-admin";
import { db } from "@/lib/mongodb";
import OpenAI from "openai";
import { AI_API_KEY, AI_BASE_URL, AI_MODEL } from "@/lib/aiConfig";
import { fetchJobAdText, JOB_AD_LINK_ERROR } from "@/lib/jobAdText";

// 1) Initialize Firebase Admin if needed
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_ADMIN_KEY!)
    ),
  });
}

// 2) OpenAI-compatible client (Gemini by default)
if (!AI_API_KEY) {
  console.error("Missing AI_API_KEY");
}
const openai = AI_API_KEY
  ? new OpenAI({
      baseURL: AI_BASE_URL,
      apiKey: AI_API_KEY,
    })
  : null;

// 3) Record shape
interface JobAdRecord {
  userId: string;
  url?: string;
  rawText?: string;
  companyName: string;
  jobTitle: string;
  postedAt: Date;
  previewHtml: string;
  createdAt: Date;
  updatedAt: Date;
}

// 4) GET /api/job-ads → list this user’s job ads
export async function GET(request: Request) {
  const auth = request.headers.get("Authorization")?.split(" ")[1];
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(auth);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const records = await db
    .collection<JobAdRecord>("jobAds")
    .find({ userId: decoded.uid })
    .sort({ createdAt: -1 })
    .toArray();

  const payload = records.map((r) => ({
    id: r._id.toString(),
    url: r.url,
    rawText: r.rawText,
    companyName: r.companyName,
    jobTitle: r.jobTitle,
    postedAt: r.postedAt.toISOString(),
    previewHtml: r.previewHtml,
  }));

  return NextResponse.json(payload);
}

// 5) POST /api/job-ads → extract & save a new job ad
export async function POST(request: Request) {
  if (!openai) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing AI_API_KEY" },
      { status: 500 }
    );
  }

  const auth = request.headers.get("Authorization")?.split(" ")[1];
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(auth);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = (await request.json()) as { url?: string; rawText?: string };
  if (!body.url && !body.rawText) {
    return NextResponse.json(
      { error: "Provide a URL or rawText" },
      { status: 400 }
    );
  }

  let adText = body.rawText ?? "";
  if (!adText && body.url) {
    adText = (await fetchJobAdText(body.url)) ?? "";
    if (!adText) {
      return NextResponse.json({ error: JOB_AD_LINK_ERROR }, { status: 422 });
    }
  }

  // Build the AI prompt
  const source = `Parse this job ad text:\n\n${adText}`;

  const systemPrompt = `
You are a job‐ad extractor. Return ONLY JSON with these fields:
{
  "companyName": string,
  "jobTitle": string,
  "postedAt": string,     // ISO date
  "previewHtml": string   // short HTML snippet
}
Today is ${new Date().toISOString().slice(0, 10)}. Convert relative dates like "4 days ago" using today's date; if no date is given, use today.
Respond with nothing else, no markdown fences.
`.trim();

  const ai = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: source },
    ],
  });

  // strip any markdown fences & trim
  let raw = ai.choices[0].message.content ?? "";
  raw = raw
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: {
    companyName: string;
    jobTitle: string;
    postedAt: string;
    previewHtml: string;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON from AI", raw },
      { status: 502 }
    );
  }

  // Save to MongoDB
  const now = new Date();
  const record: JobAdRecord = {
    userId: decoded.uid,
    url: body.url,
    rawText: adText,
    companyName: parsed.companyName,
    jobTitle: parsed.jobTitle,
    postedAt: Number.isNaN(new Date(parsed.postedAt).getTime()) ? now : new Date(parsed.postedAt),
    previewHtml: parsed.previewHtml,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection<JobAdRecord>("jobAds").insertOne(record);

  return NextResponse.json({
    id: result.insertedId.toString(),
    url: body.url,
    rawText: adText,
    companyName: parsed.companyName,
    jobTitle: parsed.jobTitle,
    postedAt: parsed.postedAt,
    previewHtml: parsed.previewHtml,
  });
}


// 6) DELETE /api/job-ads?id=... → remove one of this user's job ads
export async function DELETE(request: Request) {
  const auth = request.headers.get("Authorization")?.split(" ")[1];
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(auth);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Bad job ad ID" }, { status: 400 });
  }

  const result = await db
    .collection<JobAdRecord>("jobAds")
    .deleteOne({ _id: new ObjectId(id), userId: decoded.uid } as never);
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Job ad not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
