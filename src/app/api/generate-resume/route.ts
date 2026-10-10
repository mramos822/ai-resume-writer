import { limited } from "@/lib/rateLimit";
import { bumpResumeCount } from '@/lib/resumeCounter';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { ObjectId } from 'mongodb';
import { bucket, db } from '@/lib/mongodb';
import { ProfileData } from '@/context/profileContext';
import { renderResumeDetailed } from '@/lib/pdfResume';
import { authUid, ownedProfile, ownedJobAd, errorResponse } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  const tooMany = limited(req, "ai", 40, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    const uid = await authUid(req);
    const body = await req.json();
    const { template, format, profileId, jobAdId, withPhoto, builder, create } = body;

    if (!template) {
      return NextResponse.json({ error: 'Template not provided' }, { status: 400 });
    }
    if (format && format !== 'pdf') {
      return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
    }
    if (!profileId) {
      return NextResponse.json({ error: 'Profile not provided' }, { status: 400 });
    }

    // Only the owner can turn a profile into a resume
    const profile = await ownedProfile(uid, profileId);
    const profileData: ProfileData = {
      ...(profile.data as ProfileData),
      name: (profile.data as ProfileData)?.name || (/^Profile \d+$/.test(profile.name) ? "John Doe" : profile.name),
      internships: profile.data?.internships || [],
      projects: profile.data?.projects || [],
    };

    // The resume made by the step-by-step builder is kept apart and reused: while nothing changed the same file is
    // returned (nothing is generated again); when something changed, the old file is deleted and the new one takes its place.
    const contentHash = createHash('sha256').update(JSON.stringify({ template, withPhoto: withPhoto !== false, data: profileData })).digest('hex');
    const files = db.collection('uploads.files');
    // the builder's file is replaced when you change something: only the first one counts as a resume created
    let countsAsNew = true;
    let replaced: ObjectId[] = []; // the builder files this one takes the place of, deleted once the new file is safely saved
    if (builder === true) {
      const previous = await files.find({ 'metadata.profileId': profileId, 'metadata.origin': 'builder' }).toArray();
      const same = previous.find((f) => f.metadata?.contentHash === contentHash);
      if (same) {
        const meta = same.metadata ?? {};
        return NextResponse.json({ message: 'Your resume is up to date', fileId: same._id.toString(), reused: true, scale: meta.scale, pages: meta.pages, droppedChars: meta.droppedChars ?? [] }, { status: 200 });
      }
      countsAsNew = previous.length === 0;
      replaced = previous.map((f) => f._id);
    }

    // "Create resume": every time a new resume is added to the list, unless the very same one (same details and look) is
    // already there, which is returned instead of making a copy
    if (create === true) {
      const same = await files.findOne({ 'metadata.profileId': profileId, 'metadata.contentHash': contentHash, 'metadata.origin': 'created' });
      if (same) {
        return NextResponse.json({ message: 'You already have this resume', fileId: same._id.toString(), reused: true }, { status: 200 });
      }
    }

    const { buffer: pdfBuffer, scale, pages, droppedChars } = await renderResumeDetailed(profileData, template, { withPhoto: withPhoto !== false });

    let jobAdTitle = '';
    if (jobAdId) {
      try {
        const jobAd = await ownedJobAd(uid, jobAdId);
        if (jobAd.jobTitle) jobAdTitle = jobAd.jobTitle;
      } catch (e) {
        console.error('Failed to fetch job ad for filename:', e);
      }
    }

    // Sanitize names for filename
    const sanitize = (str: string) =>
      (str || '').replace(/[^a-z0-9\-_]+/gi, '_').replace(/^_+|_+$/g, '');
    const filename = `${sanitize(profileData.name || 'profile')}_${sanitize(jobAdTitle) || 'resume'}.pdf`;

    // Save the PDF to GridFS
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        profileId: profileId,
        template: template,
        format: 'pdf',
        createdAt: new Date(),
        isGenerated: true, // Mark as generated resume
        ...(builder === true && { origin: 'builder', contentHash, scale, pages, droppedChars }),
        ...(create === true && { origin: 'created', contentHash, scale, pages, droppedChars }),
        ...(jobAdId && { jobAdId: jobAdId }), // Conditionally add jobAdId
      },
    });
    uploadStream.end(pdfBuffer);

    const fileId = await new Promise<string>((resolve, reject) => {
      uploadStream.on('finish', () => {
        if (uploadStream.id) {
          resolve(uploadStream.id.toString());
        } else {
          reject(new Error('File ID not available after upload.'));
        }
      });
      uploadStream.on('error', reject);
    });

    for (const old of replaced) {
      try {
        await bucket.delete(new ObjectId(old));
      } catch (e) {
        console.error('Could not delete the previous builder resume', e instanceof Error ? e.message : e);
      }
    }
    if (countsAsNew) await bumpResumeCount().catch((e) => console.error('Could not update the resume counter', e));

    return NextResponse.json(
      {
        message: 'Resume generated and saved successfully',
        fileId,
        // Lets the UI tell people when their resume was shrunk or characters were left out
        scale,
        pages,
        droppedChars,
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error, 'An unexpected error occurred during PDF generation');
  }
}
