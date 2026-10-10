import { limited } from "@/lib/rateLimit";
import { NextResponse } from 'next/server';
import { getOpenAIChatCompletion } from '@/lib/openaiClient';
import { AI_MODEL } from '@/lib/aiConfig';
import { authUid, errorResponse, HttpError } from '@/lib/apiAuth';

export async function POST(request: Request) {
  const tooMany = limited(request, "ai", 40, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    await authUid(request);
    const { profile, jobAd } = await request.json();
    // Compose a prompt using the provided profile and job ad
    let prompt = `You are a warm, encouraging career coach talking to someone who is job hunting.
Look at the profile${jobAd ? " and the job posting" : ""} below and reply with short, friendly advice.

Rules:
- Start with one sentence about something they are already doing well.
- Then give 3 or 4 tips. Each tip is ONE bullet of at most two short sentences, written like you would say it to a friend.
- Be specific to their profile. Say what to add or change, not general theory.
- Plain language, no jargon, no long lists, no headings, no tables, no emojis.
- Use only "-" bullets and **bold** for a key word or two.
- Keep the whole reply under 130 words. Do not repeat the profile back.
`;
    if (profile) {
      prompt += `\nPROFILE:\n${JSON.stringify(profile, null, 2)}`;
    }
    if (jobAd) {
      prompt += `\n\nJOB POST:\n${typeof jobAd === 'string' ? jobAd : JSON.stringify(jobAd, null, 2)}`;
    }
    prompt += `\n\nYour reply:`;

    let adviceText = '';
    try {
      const completion = await getOpenAIChatCompletion({
        model: AI_MODEL,
        temperature: 0.6,
        max_tokens: 500,
        messages: [
          { role: 'user', content: prompt },
        ],
      });
      adviceText = completion.content || 'No advice generated.';
    } catch (err) {
      console.error('Advice generation failed:', err);
      adviceText = 'I could not put advice together just now. Please try again in a moment.';
    }

    return NextResponse.json({ advice: adviceText });
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err);
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
} 