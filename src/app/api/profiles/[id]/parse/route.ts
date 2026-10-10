// src/app/api/profiles/[id]/parse/route.ts

import { limited } from "@/lib/rateLimit";
import fs from "fs";
import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { ObjectId } from "mongodb";
import { db, bucket } from "@/lib/mongodb";
import mammoth from "mammoth";
import type { ProfileData } from "@/context/profileContext";
import { getChatCompletion, MODEL } from "@/lib/openai";
import { cleanParsedProfile } from "@/lib/parseCleanup";

// === Stub out pdf-parse's test-data loader ===
const originalReadFileSync = fs.readFileSync;
function stubbedReadFileSync(
  path: fs.PathOrFileDescriptor,
  options?: BufferEncoding | fs.ObjectEncodingOptions | null
): Buffer | string {
  if (typeof path === "string" && path.includes("/test/data/")) {
    return Buffer.alloc(0);
  }
  return originalReadFileSync(path, options as fs.ObjectEncodingOptions);
}
// Cast to satisfy all overloads of fs.readFileSync
fs.readFileSync = stubbedReadFileSync as unknown as typeof fs.readFileSync;

export const config = { api: { bodyParser: false } };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_ADMIN_KEY!)
    ),
  });
}


// Extract text with PDF fallback
async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    try {
      const { default: pdfParse } = await import("pdf-parse");
      const { text } = await pdfParse(buffer);
      return text;
    } catch {
      // fallback: raw UTF-8
      return buffer.toString("utf-8");
    }
  } else if (ext === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  } else {
    return buffer.toString("utf-8");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tooMany = limited(request, "ai", 40, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  const { id: profileId } = await params;

  // 1) Auth
  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/, "");
  if (!bearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const decoded = await admin.auth().verifyIdToken(bearer).catch(() => null);
  if (!decoded) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // 2) Validate profileId
  if (!ObjectId.isValid(profileId)) {
    return NextResponse.json({ error: "Bad profile ID" }, { status: 400 });
  }

  // 3) Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).fileId !== "string"
  ) {
    return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  }
  const fileId = (body as { fileId: string }).fileId;
  if (!ObjectId.isValid(fileId)) {
    return NextResponse.json({ error: "Bad fileId" }, { status: 400 });
  }

  // 4) Lookup filename
  const fileMeta = await db
    .collection("uploads.files")
    .findOne<{ filename: string }>({ _id: new ObjectId(fileId) });
  if (!fileMeta?.filename) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // 5) Stream file
  const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    downloadStream.on("data", (c: Buffer) => chunks.push(c));
    downloadStream.on("error", reject);
    downloadStream.on("end", () => resolve());
  });
  const buffer = Buffer.concat(chunks);

  // 6) Extract text
  const text = await extractText(buffer, fileMeta.filename);
  console.log("Extracted text (first 1000 chars):", text.slice(0, 1000));

  const systemPrompt = `
You are an expert resume parser.
Respond with NOTHING but a single, valid JSON object matching this interface exactly:

interface ProfileData {
  name: string;
  jobTitle: string;
  contactInfo: { email: string; phone: string; address: string; additionalEmails?: string[]; additionalPhones?: string[] };
  careerObjective: string;
  skills: string[];
  jobHistory: { company: string; title: string; location: string; description: string; startDate: string; endDate: string; current: boolean; accomplishments: string[] }[];
  education: { school: string; degree: string; location: string; startDate: string; endDate: string; current: boolean; gpa?: string; honors?: string; coursework?: string }[];
  internships: { company: string; title: string; location: string; description: string; startDate: string; endDate: string; current: boolean; accomplishments: string[] }[];
  projects: { name: string; description: string; link?: string; technologies: string[]; startDate: string; endDate: string; current: boolean; accomplishments: string[] }[];
  languages: { name: string; level: "Native" | "Fluent" | "Advanced" | "Intermediate" | "Basic" }[];
  links: { label: string; url: string }[];
  certifications: { name: string; issuer: string; year: string }[];
}

Field rules (important, follow exactly):
- "title" is ONLY the role or position (e.g. "Barista"). "company" is ONLY the employer name (e.g. "Starbucks"). Never combine them in one field.
- "location" is ONLY the city and state or country of that job or school (e.g. "Newark, NJ" or "Remote"). Put it in "location", NEVER inside "company", "school", "description" or "accomplishments". Use "" when the resume does not give one.
- "accomplishments" holds ONLY what the person did or achieved: one short sentence per bullet point written in the resume. NEVER put the job title, the company, the location, the dates or a heading into "accomplishments". If a job has no bullet points, use [].
- "school" is ONLY the name of the institution, without city, state or address ("New Jersey Institute of Technology", not "New Jersey Institute of Technology, Newark, NJ"). The place goes in "location".
- "degree" is the degree and major (e.g. "B.S. Computer Science"). Put GPA in "gpa", honors like Dean's List in "honors", and listed relevant classes in "coursework" (comma separated). Use "" when absent.
- "languages" are spoken languages only (not programming languages); map the level to Native, Fluent, Advanced, Intermediate or Basic.
- "links" are LinkedIn, GitHub, portfolio or website URLs found on the resume, with a short label.
- "certifications" are certifications, licenses and awards.

Sorting rules (important):
- "internships" is ONLY for formal internships, co-ops or traineeships done at a company or organization.
- "projects" is for personal, academic, class, hackathon, open-source, freelance or side projects (anything listed under headings like Projects, Personal Projects, Academic Projects). NEVER put these in "internships" or "jobHistory".
- For a project, "name" is the project title, "technologies" lists tools/languages used, and "accomplishments" holds its bullet points. Use empty strings for dates that are not written.

For all startDate/endDate values use YYYY-MM format (e.g. "2018-09"); set current to true and endDate to "" if the person is still enrolled or still works there (end date is "Present" or in the future).
For address use the city/state or full postal address written on the resume header (empty string if none).

Output only the JSON, no explanation.
  `.trim();

  // 7) Call AI parser
  let parsed: Partial<ProfileData>;
  try {
    const completion = await getChatCompletion({
      model: MODEL,
      temperature: 0,
      top_p: 1,
      max_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    });
    const raw = completion.choices[0].message.content ?? "";
    console.log("AI raw response (first 1000 chars):", raw.slice(0, 1000));
    console.log("AI finish_reason:", completion.choices[0].finish_reason, "raw length:", raw.length);
    // Remove Markdown code block markers if present
    const cleanedRaw = raw.replace(/^```json\s*|^```\s*|```$/gm, "").trim();
    const match = cleanedRaw.match(/\{[\s\S]*\}$/);
    if (!match) throw new Error("Invalid JSON from parser");
    // the AI sometimes still puts a place or the role in the bullets, or glues an address onto a name: fix that for sure
    parsed = cleanParsedProfile(JSON.parse(match[0]) as Partial<ProfileData>);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }

  // Give every entry an id, and make sure list fields always exist
  const withIds = <T extends { id?: string }>(list: T[] | undefined, prefix: string) =>
    (list ?? []).map((item, i) => ({ ...item, id: item.id || `${prefix}-${Date.now()}-${i}` }));
  parsed = {
    ...parsed,
    jobHistory: withIds(parsed.jobHistory, "job"),
    education: withIds(parsed.education, "edu"),
    internships: withIds(parsed.internships, "int"),
    projects: withIds(parsed.projects, "proj").map((pr) => ({
      ...pr,
      technologies: pr.technologies ?? [],
      accomplishments: pr.accomplishments ?? [],
    })),
  } as Partial<ProfileData>;

  // 8) Save to Mongo (keep the photo, which the resume text can't contain)
  const previous = await db
    .collection("profiles")
    .findOne<{ data?: { photo?: string } }>({ _id: new ObjectId(profileId), userId: decoded.uid });
  if (previous?.data?.photo) parsed = { ...parsed, photo: previous.data.photo };
  const update: Record<string, unknown> = { data: parsed, updatedAt: new Date() };
  // Use the name from the resume, unless the user already renamed the profile
  // (i.e. only replace auto-generated names like "Profile 2" or the sample "John Doe")
  const cvName = typeof parsed.name === "string" ? parsed.name.trim() : "";
  if (cvName) {
    const existing = await db
      .collection("profiles")
      .findOne<{ name?: string }>({ _id: new ObjectId(profileId), userId: decoded.uid });
    if (!existing?.name || /^(Profile \d+|John Doe)$/.test(existing.name)) {
      update.name = cvName;
    }
  }
  await db.collection("profiles").updateOne(
    { _id: new ObjectId(profileId), userId: decoded.uid },
    { $set: update }
  );

  // 9) Return parsed JSON
  return NextResponse.json(parsed);
}
