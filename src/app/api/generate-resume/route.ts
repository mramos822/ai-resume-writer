import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { getProfile, getJobAd, bucket } from '@/lib/mongodb';
import { ProfileData } from '@/context/profileContext';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log('Request body:', body);
  const { template, format, profileId, jobAdId } = body;

  if (!template) {
    return NextResponse.json({ error: 'Template not provided' }, { status: 400 });
  }

  let profileData: ProfileData;

  try {
    console.log('Fetching profile data...');
    const profile = await getProfile(profileId);
    if (!profile) {
      console.error('Profile not found for ID:', profileId);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    profileData = { ...profile.data, internships: profile.data.internships || [] };
    console.log('Profile data fetched successfully.');
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }


  try {
    console.log('Reading template file...');
    const templatePath = path.join(process.cwd(), 'src', 'templates', `${template}.tex`);
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    console.log('Template file read successfully.');

    console.log('Rendering LaTeX with EJS...');
    console.log('Profile data being passed to EJS:', profileData); // Add this line for debugging
    const renderedLatex = ejs.render(templateContent, { profile: profileData }); // Pass profileData nested under 'profile'
    console.log('LaTeX rendered successfully.');

    if (format === 'pdf') {
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
        console.log('Created temporary directory:', tempDir);
      }
      const texFilePath = path.join(tempDir, `${profileId}.tex`);
      fs.writeFileSync(texFilePath, renderedLatex);
      console.log('LaTeX content written to:', texFilePath);

      console.log('Executing xelatex command...');
      const { stdout, stderr } = await execAsync(`xelatex -output-directory=${tempDir} ${texFilePath}`);
      console.log('xelatex stdout:', stdout);
      if (stderr) {
        console.error('xelatex stderr:', stderr);
      }
      console.log('xelatex command executed.');

      const pdfFilePath = path.join(tempDir, `${profileId}.pdf`);
      console.log('Reading generated PDF from:', pdfFilePath);
      const pdfBuffer = fs.readFileSync(pdfFilePath);
      console.log('PDF read successfully.');

      fs.unlinkSync(texFilePath);
      console.log('Deleted .tex file:', texFilePath);
      fs.unlinkSync(pdfFilePath);
      console.log('Deleted .pdf file:', pdfFilePath);
      
      const logFilePath = path.join(tempDir, `${profileId}.log`);
      if (fs.existsSync(logFilePath)) {
        fs.unlinkSync(logFilePath);
        console.log('Deleted .log file:', logFilePath);
      }
      const auxFilePath = path.join(tempDir, `${profileId}.aux`);
      if (fs.existsSync(auxFilePath)) {
        fs.unlinkSync(auxFilePath);
        console.log('Deleted .aux file:', auxFilePath);
      }

      let jobAdTitle = '';
      if (jobAdId) {
        try {
          const jobAd = await getJobAd(jobAdId);
          if (jobAd && jobAd.jobTitle) {
            jobAdTitle = jobAd.jobTitle;
          }
        } catch (e) {
          console.error('Failed to fetch job ad for filename:', e);
        }
      }
      // Sanitize names for filename
      function sanitize(str: string) {
        return (str || '').replace(/[^a-z0-9\-_]+/gi, '_').replace(/^_+|_+$/g, '');
      }
      const profileName = profileData.name || 'profile';
      const filename = `${sanitize(profileName)}_${sanitize(jobAdTitle) || 'resume'}.pdf`;

      const response = new NextResponse(pdfBuffer);
      response.headers.set('Content-Type', 'application/pdf');
      response.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
      console.log('PDF response prepared and sent.');
      
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
          // The file object is not passed directly to 'finish' in some GridFS versions.
          // The _id is available on the stream itself after it finishes.
          if (uploadStream.id) {
            console.log('PDF saved to GridFS with ID:', uploadStream.id.toString());
            resolve(uploadStream.id.toString());
          } else {
            reject(new Error('File ID not available after upload.'));
          }
        });
        uploadStream.on('error', (err: Error) => {
          console.error('Error saving PDF to GridFS:', err);
          reject(err);
        });
      });

      return NextResponse.json({ message: 'Resume generated and saved successfully', fileId: fileId }, { status: 200 });
    }
  } catch (error) {
    console.error('An unexpected error occurred during PDF generation:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during PDF generation' }, { status: 500 });
  }

  return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
}
