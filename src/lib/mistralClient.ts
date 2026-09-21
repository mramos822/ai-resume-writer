import OpenAI from 'openai';

import { AI_API_KEY, AI_BASE_URL } from './aiConfig';

if (!AI_API_KEY) {
  throw new Error('Missing AI_API_KEY environment variable');
}

const mistral = new OpenAI({
  baseURL: AI_BASE_URL,
  apiKey: AI_API_KEY,
});

export async function getMistralChatCompletion(params: any) {
  const response = await mistral.chat.completions.create(params);
  let content = response.choices[0].message.content ?? '';
  // Remove markdown code fences if present
  content = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  // Extract JSON block
  const match = content.match(/\{[\s\S]*\}$/);
  return { ...response, content: match ? match[0] : content };
} 