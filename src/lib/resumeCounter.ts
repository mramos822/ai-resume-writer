import { db } from "@/lib/mongodb";

// How many resumes Kaizo has created, kept as one number that only goes up (deleting a resume does not lower it).
// The first time it is read it starts from the resumes already made.
const counters = () => db.collection<{ _id: string; n: number }>("counters");

export async function readResumeCount(): Promise<number> {
  const found = await counters().findOne({ _id: "resumes" });
  if (found) return found.n;
  const existing = await db.collection("uploads.files").countDocuments({ "metadata.isGenerated": true, "metadata.origin": { $ne: "application" } });
  await counters().updateOne({ _id: "resumes" }, { $setOnInsert: { n: existing } }, { upsert: true });
  return (await counters().findOne({ _id: "resumes" }))?.n ?? existing;
}

/** Adds one to the count (call it when a resume is really created). */
export async function bumpResumeCount(): Promise<void> {
  await readResumeCount(); // makes sure the starting number exists before adding
  await counters().updateOne({ _id: "resumes" }, { $inc: { n: 1 } });
}
