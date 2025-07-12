// src/app/api/uploads/reorder/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { verifyAuthToken } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  let uid: string;
  try {
    const decoded = await verifyAuthToken(request.headers.get("Authorization"));
    uid = decoded.uid;
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }

  // parse body
  const { orderedIds } = (await request.json()) as {
    orderedIds: string[];
  };
  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const filesColl = db.collection("uploads.files");
  // update each file’s metadata.order
  await Promise.all(
    orderedIds.map((id, idx) =>
      filesColl.updateOne(
        { _id: new ObjectId(id), "metadata.userId": uid },
        { $set: { "metadata.order": idx } }
      )
    )
  );

  return NextResponse.json({ success: true });
}
