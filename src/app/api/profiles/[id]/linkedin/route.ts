import { NextResponse } from "next/server";
import JSZip from "jszip";
import { ObjectId } from "mongodb";
import { authUid, errorResponse, HttpError, ownedProfile } from "@/lib/apiAuth";
import { db } from "@/lib/mongodb";
import { limitedShared } from "@/lib/rateLimit";
import { mergeLinkedIn, readLinkedIn } from "@/lib/linkedinImport";
import type { ProfileData } from "@/context/profileContext";

// "Import from LinkedIn": the person uploads the data export LinkedIn gave them (a ZIP, or the CSV files). It is added to the
// profile: nothing already in the profile is replaced or removed.
const WANTED = ["profile.csv", "positions.csv", "education.csv", "skills.csv", "languages.csv", "certifications.csv", "projects.csv"];
const MAX_UPLOAD = 10 * 1024 * 1024;
const MAX_CSV = 2 * 1024 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tooMany = await limitedShared(req, "linkedin-import", 15, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    const uid = await authUid(req);
    const { id } = await params;
    const profile = await ownedProfile(uid, id);

    const form = await req.formData();
    const uploads = form.getAll("file").filter((f): f is File => f instanceof File);
    if (uploads.length === 0) throw new HttpError(400, "Choose the file LinkedIn gave you.");
    if (uploads.reduce((n, f) => n + f.size, 0) > MAX_UPLOAD) throw new HttpError(413, "That file is too large. The limit is 10 MB.");

    const files: Record<string, string> = {};
    for (const f of uploads) {
      const buf = Buffer.from(await f.arrayBuffer());
      if (/\.zip$/i.test(f.name) || f.type.includes("zip")) {
        const zip = await JSZip.loadAsync(buf).catch(() => null);
        if (!zip) throw new HttpError(400, "We couldn't open that ZIP file.");
        for (const entry of Object.values(zip.files)) {
          const base = entry.name.split("/").pop()?.toLowerCase() ?? "";
          if (entry.dir || !WANTED.includes(base)) continue;
          const bytes = await entry.async("uint8array");
          if (bytes.length <= MAX_CSV) files[base] = Buffer.from(bytes).toString("utf-8");
        }
      } else {
        const base = f.name.split(/[\\/]/).pop()?.toLowerCase() ?? "";
        if (WANTED.includes(base) && buf.length <= MAX_CSV) files[base] = buf.toString("utf-8");
      }
    }
    if (Object.keys(files).length === 0) {
      throw new HttpError(422, "We didn't find LinkedIn data in that file. Upload the ZIP LinkedIn sent you, or files like Positions.csv, Education.csv and Skills.csv.");
    }

    const incoming = readLinkedIn(files);
    const { data, added } = mergeLinkedIn(profile.data as ProfileData, incoming);
    await db.collection("profiles").updateOne({ _id: new ObjectId(id), userId: uid }, { $set: { data, updatedAt: new Date() } });
    return NextResponse.json({ added, found: Object.keys(files).map((n) => n.replace(".csv", "")) });
  } catch (err) {
    return errorResponse(err, "We couldn't import that file.");
  }
}
