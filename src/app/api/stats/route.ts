import { NextResponse } from "next/server";
import { readResumeCount } from "@/lib/resumeCounter";

// Public: the landing page shows how many resumes have been created
export async function GET() {
  try {
    const resumes = await readResumeCount();
    return NextResponse.json({ resumes }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ resumes: null }, { status: 200 });
  }
}
