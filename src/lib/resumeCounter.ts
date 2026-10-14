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

/** The looks people really made a resume with, one count per look (only resumes of registered accounts). */
export async function bumpTemplateCount(template: string): Promise<void> {
  if (!/^[a-z0-9_-]{1,40}$/.test(template)) return;
  // the resume being counted is already saved: when the counts are made now they include it, so it is not added twice
  if (await seedTemplateCounts()) return;
  await counters().updateOne({ _id: `template:${template}` }, { $inc: { n: 1 } }, { upsert: true });
}

/**
 * The first time they are read, the counts start from the resumes already made (the look saved in each file), and what is left of the
 * total (resumes that were deleted since) is shared among the looks in the same proportion, so the looks always add up to the total.
 */
/** Returns true when it just did the seeding. */
async function seedTemplateCounts(): Promise<boolean> {
  if (await counters().findOne({ _id: "templates_seeded" })) return false;
  const total = await readResumeCount();
  const rows = await db
    .collection("uploads.files")
    .aggregate<{ _id: string; n: number }>([
      { $match: { "metadata.isGenerated": true, "metadata.origin": { $ne: "application" }, "metadata.template": { $type: "string" } } },
      { $group: { _id: "$metadata.template", n: { $sum: 1 } } },
    ])
    .toArray();
  const counts: Record<string, number> = {};
  for (const r of rows) if (/^[a-z0-9_-]{1,40}$/.test(r._id)) counts[r._id] = r.n;
  const ids = Object.keys(counts);
  let left = total - ids.reduce((n, id) => n + counts[id], 0);
  if (left > 0 && ids.length > 0) {
    const base = ids.reduce((n, id) => n + counts[id], 0) || ids.length;
    const share = ids.map((id) => ({ id, exact: (left * (counts[id] || 1)) / base }));
    for (const x of share) counts[x.id] += Math.floor(x.exact);
    left = total - ids.reduce((n, id) => n + counts[id], 0);
    share.sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)));
    for (let i = 0; left > 0; i = (i + 1) % share.length, left--) counts[share[i].id] += 1;
  }
  // $setOnInsert: another request seeding at the same moment (or a resume made meanwhile) is never overwritten
  for (const id of ids) await counters().updateOne({ _id: `template:${id}` }, { $setOnInsert: { n: counts[id] } }, { upsert: true });
  await counters().updateOne({ _id: "templates_seeded" }, { $setOnInsert: { n: 1 } }, { upsert: true });
  return true;
}

export async function readTemplateCounts(): Promise<Record<string, number>> {
  await seedTemplateCounts();
  const rows = await counters().find({ _id: { $regex: "^template:" } as never }).toArray();
  return Object.fromEntries(rows.map((r) => [String(r._id).slice("template:".length), r.n]));
}

/** Adds one to the count (call it when a resume is really created). */
export async function bumpResumeCount(): Promise<void> {
  await readResumeCount(); // makes sure the starting number exists before adding
  await counters().updateOne({ _id: "resumes" }, { $inc: { n: 1 } });
}
