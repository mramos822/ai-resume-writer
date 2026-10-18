import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { bucket, db } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { convertPdfToDocx } from '@/lib/pdfConverter';
import { authUid, assertResumeOwner, errorResponse } from '@/lib/apiAuth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const { fileId } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'pdf'; // Default to pdf
    const viewMode = searchParams.get('view') === 'true';

    if (!fileId) {
      return NextResponse.json({ error: 'File ID not provided' }, { status: 400 });
    }

    const uid = await authUid(req);
    // downloading needs an account (the front end asks guests to make one; this keeps it true for anyone calling the API)
    if (uid.startsWith('guest-')) {
      return NextResponse.json({ error: 'Create a free account to download your resume.', code: 'account-required' }, { status: 403 });
    }
    await assertResumeOwner(uid, fileId);

    const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));

    const chunks: Buffer[] = [];
    downloadStream.on('data', (chunk) => chunks.push(chunk));
    await new Promise((resolve, reject) => {
      downloadStream.on('end', resolve);
      downloadStream.on('error', reject);
    });

    let outputBuffer = Buffer.concat(chunks);
    let contentType = 'application/pdf';
    let filename = `resume-${fileId}.pdf`;

    const file = await bucket.find({ _id: new ObjectId(fileId) }).next();

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (format === 'docx') {
      try {
        // the words of the file name (it starts with the person's name) help to put the spaces back in a letter-spaced name
        const hints = String(file.filename ?? "").split(/[^\p{L}]+/u).filter((w) => w.length >= 2);
        outputBuffer = Buffer.from(await convertPdfToDocx(outputBuffer, hints));
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        filename = `resume-${fileId}.docx`;
      } catch (conversionError) {
        console.error('PDF to DOCX conversion failed:', conversionError);
        return NextResponse.json({ error: 'Failed to convert PDF to DOCX' }, { status: 500 });
      }
    } else { // format is pdf
      contentType = 'application/pdf';
      filename = `resume-${fileId}.pdf`;
    }

    const response = new NextResponse(outputBuffer);
    response.headers.set('Content-Type', contentType);
    response.headers.set('X-Filename', encodeURIComponent(String(file.filename || '')));
    response.headers.set('Content-Disposition', `${viewMode ? 'inline' : 'attachment'}; filename="${filename}"`);
    return response;
  } catch (error) {
    return errorResponse(error, 'Failed to download resume');
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const uid = await authUid(req);
    const { fileId } = await params;
    const { filename } = await req.json();
    if (!fileId || !filename) {
      return NextResponse.json({ error: 'File ID and filename are required' }, { status: 400 });
    }
    await assertResumeOwner(uid, fileId);
    // Update the filename in GridFS
    const result = await db.collection('uploads.files').updateOne(
      { _id: new ObjectId(fileId) },
      { $set: { filename } }
    );
    if (result.modifiedCount === 1) {
      return NextResponse.json({ message: 'Filename updated', filename });
    } else {
      return NextResponse.json({ error: 'File not found or not updated' }, { status: 404 });
    }
  } catch (error) {
    return errorResponse(error, 'Failed to rename resume');
  }
}
