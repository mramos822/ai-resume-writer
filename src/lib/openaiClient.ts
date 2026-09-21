import OpenAI from 'openai';
import type { ChatCompletionCreateParams, ChatCompletion } from 'openai/resources/chat/completions/completions';

import { AI_API_KEY, AI_BASE_URL } from './aiConfig';

if (!AI_API_KEY) {
  throw new Error('Missing AI_API_KEY environment variable');
}

const openai = new OpenAI({
  baseURL: AI_BASE_URL,
  apiKey: AI_API_KEY,
});

export { openai };

export async function getOpenAIChatCompletion(params: ChatCompletionCreateParams) {
  const response = await openai.chat.completions.create(params) as ChatCompletion;
  let content = response.choices[0].message.content ?? '';
  // Remove markdown code fences if present
  content = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  // Extract JSON block
  const match = content.match(/\{[\s\S]*\}$/);
  return { ...response, content: match ? match[0] : content };
} 