import { NextResponse } from 'next/server';
import { getOpenAIChatCompletion } from '@/lib/openaiClient';

export async function POST(request: Request) {
  try {
    const { profile, jobAd } = await request.json();
    // Compose a prompt using the provided profile and job ad
    let prompt = `You are a career coach. Analyze the following resume/profile and job posting, and give actionable, concise advice to improve the resume for this job.\n\n`;
    if (profile) {
      prompt += `\nPROFILE:\n${JSON.stringify(profile, null, 2)}`;
    }
    if (jobAd) {
      prompt += `\n\nJOB POST:\n${typeof jobAd === 'string' ? jobAd : JSON.stringify(jobAd, null, 2)}`;
    }
    prompt += `\n\nAdvice:`;

    let adviceText = '';
    try {
      const completion = await getOpenAIChatCompletion({
        model: process.env.AI_MODEL || 'mistral-ai/mistral-medium-2505',
        temperature: 0.7,
        max_tokens: 400,
        messages: [
          { role: 'system', content: prompt },
        ],
      });
      adviceText = completion.content || 'No advice generated.';
    } catch {
      adviceText = 'Unable to generate advice at this time.';
    }

    return NextResponse.json({ advice: adviceText });
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
} 