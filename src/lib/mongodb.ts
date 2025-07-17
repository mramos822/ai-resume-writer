// src/lib/mongodb.ts
import { MongoClient, GridFSBucket, ObjectId } from "mongodb";

const {
  MONGODB_USER,
  MONGODB_PASS,
  MONGODB_HOST="cs490-project.l66ga0z.mongodb.net",
  MONGODB_DB="CS490-Project"
} = process.env;

  
if (!MONGODB_USER || !MONGODB_PASS) {
    throw new Error("Please define the MONGODB_URI environment variable");
}

// automatically escape any special chars in the password
const encodedPass = encodeURIComponent(MONGODB_PASS);

// build your connection string
const uri = `mongodb+srv://${MONGODB_USER}:${encodedPass}@${MONGODB_HOST}/?retryWrites=true&w=majority&appName=${MONGODB_DB}`;

const options = {}; // Add your MongoClientOptions here if needed

// Tell TypeScript about our custom global
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let client: MongoClient;

if (process.env.NODE_ENV === "development") {
  // In dev, reuse the client promise across module reloads
  if (!globalThis._mongoClientPromise) {
    const mongoClient = new MongoClient(uri, options);
    globalThis._mongoClientPromise = mongoClient.connect();
  }
  client = await globalThis._mongoClientPromise;
} else {
  // In production, it's fine to create a new client
  client = new MongoClient(uri, options);
  await client.connect();
}

const db = client.db(); // default database from URI

const bucket = new GridFSBucket(db, {
  bucketName: "uploads", // will create `uploads.files` & `uploads.chunks`
});

export async function getProfile(profileId: string) {
    const profiles = db.collection('profiles');
    const profile = await profiles.findOne({ _id: new ObjectId(profileId) });
    return profile;
}

export async function getJobAd(jobAdId: string) {
    const jobAds = db.collection('jobAds');
    const jobAd = await jobAds.findOne({ _id: new ObjectId(jobAdId) });
    return jobAd;
}

export { client, db, bucket };
