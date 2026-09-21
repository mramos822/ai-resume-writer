import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { bucket } from '@/lib/mongodb';
import { ProfileData } from '@/context/profileContext';
import { renderResumeDetailed } from '@/lib/pdfResume';
import { authUid, ownedProfile, ownedJobAd, errorResponse } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  try {
    const uid = await authUid(req);
    const body = await req.json();
    const { template, format, profileId, jobAdId } = body;

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
      name: (profile.data as ProfileData)?.name || profile.name,
      internships: profile.data?.internships || [],
      projects: profile.data?.projects || [],
    };

    const { buffer: pdfBuffer, scale, pages, droppedChars } = await renderResumeDetailed(profileData, template);

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
