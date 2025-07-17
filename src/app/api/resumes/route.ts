import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { bucket, db } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');

    if (!profileId) {
      return NextResponse.json({ error: 'Profile ID not provided' }, { status: 400 });
    }

    const resumes = await db.collection('uploads.files').aggregate([
      {
        $match: { 'metadata.profileId': profileId }
      },
      {
        $lookup: {
          from: 'profiles', // The collection to join with
          localField: 'metadata.profileId',
          foreignField: '_id',
          as: 'profileInfo'
        }
      },
      {
        $unwind: {
          path: '$profileInfo',
          preserveNullAndEmptyArrays: true // Keep resumes even if profile not found
        }
      },
      {
        $lookup: {
          from: 'job-ads', // The collection to join with
          localField: 'metadata.jobAdId', // Assuming jobAdId is stored in metadata
          foreignField: '_id',
          as: 'jobAdInfo'
        }
      },
      {
        $unwind: {
          path: '$jobAdInfo',
          preserveNullAndEmptyArrays: true // Keep resumes even if job ad not found
        }
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          filename: '$filename',
          uploadDate: '$uploadDate',
          metadata: '$metadata',
          profileName: '$profileInfo.name', // Assuming profile has a 'name' field
          jobAdTitle: '$jobAdInfo.jobTitle', // Assuming job ad has a 'jobTitle' field
          isGenerated: '$metadata.isGenerated' // Include the isGenerated field
        }
      }
    ]).toArray();

    return NextResponse.json(resumes, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch resumes:', error);
    return NextResponse.json({ error: 'Failed to fetch resumes' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID not provided' }, { status: 400 });
    }

    await bucket.delete(new ObjectId(fileId));

    return NextResponse.json({ message: 'Resume deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Failed to delete resume:', error);
    return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 });
  }
}
