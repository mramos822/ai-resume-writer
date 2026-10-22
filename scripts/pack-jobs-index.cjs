// One-off: compresses the plain `description` of the documents already in `jobs_index` (see src/lib/ingest/pack.ts). The app reads both forms, so it is safe
// to run it (and to stop it) at any time. It counts what the free plan of Atlas counts: the size of the data.
//   node scripts/pack-jobs-index.cjs          -> only says what it would do
//   node scripts/pack-jobs-index.cjs --apply  -> does it
// Needs the variables of .env.local (MONGODB_USER, MONGODB_PASS, MONGODB_HOST).
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { MongoClient, Binary } = require("mongodb");

const env = { ...process.env };
try {
  for (const l of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
    const m = /^(MONGODB_[A-Z_]+)=(.*)$/.exec(l);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch {
  /* the variables may already be in the environment */
}
const apply = process.argv.includes("--apply");
const mb = (n) => (n / 1048576).toFixed(1);

(async () => {
  const uri = `mongodb+srv://${env.MONGODB_USER}:${encodeURIComponent(env.MONGODB_PASS)}@${env.MONGODB_HOST}/?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const col = client.db("test").collection("jobs_index"); // the database the app uses (the default of its connection string)
  const before = await client.db("test").stats();
  console.log(`before: data ${mb(before.dataSize)} MB + indexes ${mb(before.indexSize)} MB`);
  const filter = { description: { $type: "string" }, $expr: { $gte: [{ $strLenCP: "$description" }, 600] } };
  const todo = await col.countDocuments(filter);
  console.log(`documents with a plain description of 600+ characters: ${todo}`);
  if (!apply) {
    console.log("(dry run: nothing changed; run again with --apply)");
    return client.close();
  }
  let done = 0, rawBytes = 0, packedBytes = 0;
  for (;;) {
    const docs = await col.find(filter, { projection: { description: 1 } }).limit(200).toArray();
    if (docs.length === 0) break;
    const ops = docs.map((d) => {
      const raw = Buffer.from(d.description, "utf8");
      const z = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } });
      rawBytes += raw.length; packedBytes += z.length;
      // only while it still has the plain text it was read with: a document the ingestion rewrote meanwhile is left alone
      return { updateOne: { filter: { _id: d._id, description: d.description }, update: { $set: { descZ: new Binary(z) }, $unset: { description: "" } } } };
    });
    const res = await col.bulkWrite(ops, { ordered: false });
    done += res.modifiedCount;
    process.stdout.write(`\r${done}/${todo}  ${mb(rawBytes)} MB -> ${mb(packedBytes)} MB`);
  }
  console.log("");
  const after = await client.db("test").stats();
  console.log(`after:  data ${mb(after.dataSize)} MB + indexes ${mb(after.indexSize)} MB (was ${mb(before.dataSize + before.indexSize)} MB)`);
  await client.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
