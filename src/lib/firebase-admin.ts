import admin from "firebase-admin";

// Initialize Firebase Admin once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_ADMIN_KEY!)
    ),
  });
}

export default admin;

// Helper function for API route authentication
export async function verifyAuthToken(authHeader: string | null): Promise<admin.auth.DecodedIdToken> {
  const auth = authHeader || "";
  const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!idToken) {
    throw new Error("Unauthorized");
  }
  
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch {
    throw new Error("Invalid token");
  }
}
