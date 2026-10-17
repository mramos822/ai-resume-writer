// src/app/api/profiles/[id]/parse/route.ts

import { fromShouting } from "@/lib/nameCase";
import { groupsFromCategories } from "@/lib/skillCategories";
import { limitedShared } from "@/lib/rateLimit";
import fs from "fs";
import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { ObjectId } from "mongodb";
import { db, bucket } from "@/lib/mongodb";
import mammoth from "mammoth";
import type { ProfileData } from "@/context/profileContext";
import { getChatCompletion, MODEL } from "@/lib/openai";
import { cleanParsedProfile } from "@/lib/parseCleanup";
import { placeOfSchool } from "@/lib/worldSchools";
import { normalizeContact } from "@/lib/addressParse";
import { canReadScans, transcribePdf } from "@/lib/ocr";
import { extractPdfPhoto } from "@/lib/pdfPhoto";
import { parseAiJson, ANY_LANGUAGE_RULES, MIN_READABLE_CHARS, cleanExtractedText, extractJsonObject } from "@/lib/resumeText";

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
  const tooMany = await limitedShared(request, "ai", 40, 10 * 60 * 1000);
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
  // only the owner's own upload, into the owner's own profile (never another person's file or profile)
  const ownProfile = await db.collection("profiles").findOne({ _id: new ObjectId(profileId), userId: decoded.uid }, { projection: { _id: 1 } });
  if (!ownProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  const fileMeta = await db
    .collection("uploads.files")
    .findOne<{ filename: string }>({ _id: new ObjectId(fileId), "metadata.userId": decoded.uid });
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
  let text: string;
  try {
    text = await extractText(buffer, fileMeta.filename);
  } catch (err) {
    console.error("Could not extract the text of the file", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "We couldn't read that file. Try a PDF or Word document with selectable text." }, { status: 422 });
  }
  text = cleanExtractedText(text);
  // the portrait of a resume made on the computer is one of the pictures inside the PDF (a scan has no separate pictures)
  const isPdf = fileMeta.filename.toLowerCase().endsWith(".pdf");
  const pdfPhoto = isPdf && text.length >= MIN_READABLE_CHARS ? await extractPdfPhoto(buffer) : null;
  // a scan or a photo saved as PDF has no text: the provider reads the pages and gives the text back
  if (text.length < MIN_READABLE_CHARS && isPdf && canReadScans()) {
    text = cleanExtractedText(await transcribePdf(buffer).catch(() => ""));
  }
  if (text.length < MIN_READABLE_CHARS) {
    return NextResponse.json({ error: "We couldn't find any text in that file. If it is a scan or a photo, export it as a PDF with selectable text, or upload a Word file." }, { status: 422 });
  }
  text = text.slice(0, 40000);

  const systemPrompt = `
You are an expert resume parser.
Respond with NOTHING but a single, valid JSON object matching this interface exactly:

interface ProfileData {
  resumeLanguage: string; // two-letter ISO 639-1 code of the language the resume itself is written in, for example "de", "en", "es", "fr"
  name: string;
  jobTitle: string;
  contactInfo: { email: string; phone: string; address: string; city: string; state: string; country: string; additionalEmails?: string[]; additionalPhones?: string[] };
  careerObjective: string;
  skills: string[];
  skillCategories: { name: string; skills: string[] }[];
  jobHistory: { company: string; title: string; location: string; description: string; startDate: string; endDate: string; current: boolean; selfEmployed?: boolean; accomplishments: string[] }[];
  education: { school: string; degree: string; location: string; startDate: string; endDate: string; current: boolean; gpa?: string; honors?: string; coursework?: string }[];
  internships: { company: string; title: string; location: string; description: string; startDate: string; endDate: string; current: boolean; accomplishments: string[] }[];
  projects: { name: string; description: string; link?: string; technologies: string[]; startDate: string; endDate: string; current: boolean; accomplishments: string[] }[];
  languages: { name: string; level: "Native" | "Fluent" | "Advanced" | "Intermediate" | "Basic" }[];
  links: { label: string; url: string }[];
  certifications: { name: string; issuer: string; year: string }[];
  interests: string[];
}

Field rules (important, follow exactly):
- "jobTitle" is the role the person is AIMING for, not simply their last job. Use, in this order: a headline or target written at the top of the resume; else, when the person is still studying (an education entry in progress) and their jobs are unrelated side jobs (waiter, cashier, delivery, babysitter, retail, etc.), the field they study as a student headline (for example "Systems Engineering Student"); else the title of the most recent job that is a real career role. NEVER copy the title of an unrelated side job as the target of someone who is studying a different field.
- "title" is ONLY the role or position (e.g. "Barista"). "company" is ONLY the employer name (e.g. "Starbucks"). Never combine them in one field. "company" is a NAME, never a web address: when the resume shows a link ("mygeochallenge.com") next to or instead of the name, write the name of the organization or project as the resume writes it ("myGeoChallenge") and leave the link out.
- "selfEmployed" is true for a job the person did for themselves (self-employed, freelance, independent contractor, own business or own company) and false for any job with an employer. "company" is ALWAYS what the resume says (an employer, a platform like Uber, or the name of their own business): never replace it with "Self-employed". Only when the resume gives no company at all for that job, set "company" to "Self-employed".
- "location" is ONLY the city and state or country of that job or school (e.g. "Newark, NJ" or "Remote"). Put it in "location", NEVER inside "company", "school", "description" or "accomplishments". Use "" when the resume does not give one.
- "accomplishments" holds ONLY what the person did or achieved: one short sentence per bullet point written in the resume. NEVER put the job title, the company, the location, the dates or a heading into "accomplishments". If a job has no bullet points, use [].
- "school" is ONLY the name of the institution, without city, state or address ("New Jersey Institute of Technology", not "New Jersey Institute of Technology, Newark, NJ"). The place goes in "location".
- "degree" is the degree and major (e.g. "B.S. Computer Science"). Put GPA in "gpa", honors like Dean's List in "honors", and listed relevant classes in "coursework" (comma separated). Use "" when absent.
- "skills" is the flat list of every skill, tool and technology on the resume, one entry each (never "Languages: Java, C" as one entry).
- "skillCategories": when the resume itself splits its skills under labels (for example "Languages: Java, Python", "Frameworks and Databases: React, SQL", "Cloud/Backend: Firebase", "Technologies: Git, VSCode"), list each label with its skills, using the label exactly as written. Every skill listed there must also be in "skills". Use [] when the skills are one plain list. A label for SPOKEN languages ("Languages: English, Spanish") is NOT a skill category: those go in "languages".
- "languages" are spoken languages only (not programming languages); map the level to Native, Fluent, Advanced, Intermediate or Basic.
- "links" are LinkedIn, GitHub, portfolio or website URLs found on the resume, with a short label.
- "certifications" are certifications, licenses and awards.
- "interests" are the volunteering, clubs, community activities, informal jobs (babysitting, tutoring) and hobbies the resume lists under headings like Interests, Volunteering, Activities or Hobbies: one short line each (for example "Food bank volunteer"), [] when there are none.

Sorting rules (important):
- "internships" is ONLY for formal internships, co-ops or traineeships done at a company or organization.
- "projects" is for personal, academic, class, hackathon, open-source, freelance or side projects (anything listed under headings like Projects, Personal Projects, Academic Projects). NEVER put these in "internships" or "jobHistory".
- For a project, "name" is the project title, "technologies" lists tools/languages used, and "accomplishments" holds its bullet points. Use empty strings for dates that are not written.

For all startDate/endDate values use YYYY-MM format (e.g. "2018-09"); set current to true and endDate to "" if the person is still enrolled or still works there (end date is "Present" or in the future).
For the person's own place (resume header) split it into parts: "address" is ONLY the street line (e.g. "640 Irvington Ave."), "city" is the city or town, "state" is the full name of the state, province or region (write "New Jersey", never "NJ"), "country" is the country in English (e.g. "United States", "Peru"). Never put the whole line in "address". If the resume gives only city and state, leave "address" empty. Omit the zip/postal code. If a part is not written, infer it only when it is certain (e.g. a US state implies "United States"), otherwise use "".

${ANY_LANGUAGE_RULES}
Output only the JSON, no explanation.
  `.trim();

  // 7) Call AI parser
  let parsed: Partial<ProfileData>;
  try {
    // The AI is asked for strict JSON. If it still slips (an unquoted word in a list, a cut-off answer), it is asked again once.
    let read: Partial<ProfileData> | null = null;
    let lastError = "Invalid JSON from parser";
    for (let attempt = 0; attempt < 2 && !read; attempt++) {
      const completion = await getChatCompletion({
        model: MODEL,
        temperature: 0,
        top_p: 1,
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      });
      const raw = completion.choices[0].message.content ?? "";
      const json = extractJsonObject(raw);
      if (!json) continue;
      try {
        read = parseAiJson<Partial<ProfileData>>(json);
      } catch (e) {
        lastError = (e as Error).message;
        console.error("The AI answer was not valid JSON (attempt " + (attempt + 1) + "):", lastError);
      }
    }
    if (!read) throw new Error(lastError);
    // the AI sometimes still puts a place or the role in the bullets, or glues an address onto a name: fix that for sure
    parsed = cleanParsedProfile(read);
    // The two touch-ups below only improve what the AI read: if one of them fails, the resume is still read without it.
    try {
      // a known school brings its place when the resume did not give one
      parsed = { ...parsed, education: (parsed.education ?? []).map((e) => (e.location?.trim() ? e : { ...e, location: placeOfSchool(e.school) || e.location || "" })) };
    } catch (err) {
      console.error("School places skipped", err instanceof Error ? err.message : err);
    }
    try {
      // street, city, region and country as separate fields (the AI sometimes still returns one line or "NJ")
      if (parsed.contactInfo) parsed = { ...parsed, contactInfo: { ...parsed.contactInfo, ...normalizeContact(parsed.contactInfo) } };
    } catch (err) {
      console.error("Address split skipped", err instanceof Error ? err.message : err);
    }
    // the groups of skills written on the resume (like "Languages: Java, C") are kept: each skill remembers its group
    const rawCategories = (parsed as { skillCategories?: unknown }).skillCategories;
    const grouped = groupsFromCategories(parsed.skills ?? [], rawCategories);
    delete (parsed as { skillCategories?: unknown }).skillCategories;
    parsed = { ...parsed, skills: grouped.skills, skillGroups: grouped.skillGroups };
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
    .findOne<{ name?: string; data?: { photo?: string; name?: string; accentColor?: string; fillPage?: boolean; pageGoal?: string; sectionOrder?: string[] } }>({ _id: new ObjectId(profileId), userId: decoded.uid });
  // the photo the person already has stays; otherwise the one of the resume is used
  const keepPhoto = previous?.data?.photo || pdfPhoto;
  if (keepPhoto) parsed = { ...parsed, photo: keepPhoto };
  // what the person chose about how the resume LOOKS is not in the text of a resume: reading a file must not wipe it
  const keepLook: Record<string, unknown> = {};
  for (const k of ["accentColor", "fillPage", "pageGoal", "sectionOrder"] as const) if (previous?.data?.[k] !== undefined) keepLook[k] = previous.data[k];
  parsed = { ...parsed, ...keepLook };
  // the language of the resume is only for the answer (to offer a translation): it is not part of the saved profile
  const resumeLanguage = typeof parsed.resumeLanguage === "string" ? parsed.resumeLanguage.trim().toLowerCase().slice(0, 2) : "";
  delete parsed.resumeLanguage;
  const update: Record<string, unknown> = { data: parsed, updatedAt: new Date() };
  // The profile takes the name of the resume it was read from. Only a name the person chose by hand is kept: that is a name that is
  // neither generated ("Profile 2", the sample "John Doe") nor the name of the resume read before (otherwise reading a second
  // resume would keep showing the first one's name).
  // a look that prints the name in capitals must not leave the profile shouting
  if (typeof parsed.name === "string") parsed.name = fromShouting(parsed.name);
  if (typeof parsed.jobTitle === "string") parsed.jobTitle = fromShouting(parsed.jobTitle);
  const cvName = typeof parsed.name === "string" ? parsed.name.trim() : "";
  if (cvName) {
    const current = (previous?.name ?? "").trim();
    const fromBefore = (previous?.data?.name ?? "").trim();
    if (!current || /^(Profile \d+|John Doe)$/.test(current) || (fromBefore && current.toLowerCase() === fromBefore.toLowerCase())) {
      update.name = cvName;
    }
  }
  await db.collection("profiles").updateOne(
    { _id: new ObjectId(profileId), userId: decoded.uid },
    { $set: update }
  );

  // 9) Return parsed JSON
  return NextResponse.json(resumeLanguage ? { ...parsed, resumeLanguage } : parsed);
}
