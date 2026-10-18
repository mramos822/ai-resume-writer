import { db } from "@/lib/mongodb";

// Versioned database changes. Each one runs once, in order, and is recorded in `schema_migrations`, so a new server (or a restored
// backup) ends up with the same indexes and shape as the others. To change the database, ADD a migration at the end: never edit one
// that already ran.
interface Migration {
  id: number;
  name: string;
  up: () => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "indexes on what the app filters by",
    up: async () => {
      await Promise.all([
        db.collection("profiles").createIndex({ userId: 1 }),
        db.collection("uploads.files").createIndex({ "metadata.profileId": 1 }),
        db.collection("uploads.files").createIndex({ "metadata.userId": 1 }),
        db.collection("jobAds").createIndex({ userId: 1 }),
        db.collection("applications").createIndex({ userId: 1 }),
        db.collection("savedJobs").createIndex({ userId: 1 }),
        db.collection("contact_messages").createIndex({ createdAt: -1 }),
      ]);
    },
  },
  {
    id: 2,
    name: "job catalog: searches and jobs already read expire by themselves (the boards' terms limit how long their data is kept)",
    up: async () => {
      await Promise.all([
        db.collection("job_catalog").createIndex({ key: 1 }, { unique: true }),
        db.collection("job_catalog").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection("job_queries").createIndex({ qkey: 1 }, { unique: true }),
        db.collection("job_queries").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection("job_reads").createIndex({ key: 1 }, { unique: true }),
        db.collection("job_reads").createIndex({ at: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }),
      ]);
    },
  },
  {
    id: 3,
    name: "jobs_index: the openings the automatic ingestion keeps (search by title, company and area; closed ones are removed after two weeks)",
    up: async () => {
      const c = db.collection("jobs_index");
      await Promise.all([
        c.createIndex({ key: 1 }, { unique: true }),
        c.createIndex({ title: "text", company: "text", tags: "text" }, { weights: { title: 10, company: 5, tags: 2 }, name: "jobs_text" }),
        c.createIndex({ board: 1, active: 1, lastSeenAt: 1 }),
        c.createIndex({ active: 1, remote: 1, postedAt: -1 }),
        c.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      ]);
    },
  },
];

let started: Promise<void> | null = null;

/** Runs the migrations that have not run yet. Safe to call many times: it does the work once per server start. */
export function runMigrations(): Promise<void> {
  if (!started) {
    started = (async () => {
      const done = new Set((await db.collection<{ _id: number }>("schema_migrations").find().toArray()).map((m) => m._id));
      for (const m of MIGRATIONS) {
        if (done.has(m.id)) continue;
        await m.up();
        await db.collection<{ _id: number }>("schema_migrations").insertOne({ _id: m.id, name: m.name, at: new Date() } as never);
      }
    })().catch((e) => {
      started = null; // try again next time
      console.error("Migrations failed", e instanceof Error ? e.message : e);
    });
  }
  return started;
}
