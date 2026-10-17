import OpenAI from 'openai';
import type { ChatCompletionCreateParams, ChatCompletion } from 'openai/resources/chat/completions/completions';

import { AI_API_KEY, AI_BASE_URL, AI_MODEL } from './aiConfig';

if (!AI_API_KEY) {
  throw new Error('Missing AI_API_KEY environment variable');
}

const openai = new OpenAI({
  baseURL: AI_BASE_URL,
  apiKey: AI_API_KEY,
  timeout: 60_000, // never wait on the provider for more than a minute unless a call sets its own
});

export { openai };

export async function getOpenAIChatCompletion(params: ChatCompletionCreateParams, options?: { timeout?: number; maxRetries?: number }) {
  const response = await openai.chat.completions.create(params, options) as ChatCompletion;
  let content = response.choices[0].message.content ?? '';
  // Remove markdown code fences if present
  content = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  // Extract JSON block
  const match = content.match(/\{[\s\S]*\}$/);
  return { ...response, content: match ? match[0] : content };
} 
/**
 * Same as getOpenAIChatCompletion, but when the model asked for fails (busy, over its quota, not available), the same request is made once
 * with the standard model (AI_MODEL), so a stronger model that is having a bad moment never leaves the person with nothing.
 */
export async function getOpenAIChatCompletionWithFallback(params: ChatCompletionCreateParams, options?: { timeout?: number; maxRetries?: number }) {
  try {
    return await getOpenAIChatCompletion(params, options);
  } catch (err) {
    if (!AI_MODEL || params.model === AI_MODEL) throw err;
    console.error(`AI: ${params.model} failed, answering with ${AI_MODEL}`, err instanceof Error ? err.message : err);
    return getOpenAIChatCompletion({ ...params, model: AI_MODEL }, options);
  }
}
/**
 * Same as getOpenAIChatCompletion, but the answer is read as it is written, and `onChars` is told how many characters have arrived
 * (so a progress bar can follow the real work instead of guessing). If nothing arrives for a while (a provider that does not
 * stream well), it stops waiting and asks for the whole answer at once instead, so the person is never left waiting.
 */
export async function getOpenAIChatCompletionProgress(
  params: ChatCompletionCreateParams,
  options: { timeout?: number; maxRetries?: number } | undefined,
  onChars: (chars: number) => void
) {
  const ctrl = new AbortController();
  let stall: ReturnType<typeof setTimeout> | undefined;
  const arm = (ms: number) => {
    if (stall) clearTimeout(stall);
    stall = setTimeout(() => ctrl.abort(), ms);
  };
  try {
    arm(10_000); // the first piece should come quickly
    const stream = await openai.chat.completions.create({ ...params, stream: true } as ChatCompletionCreateParams & { stream: true }, { ...options, signal: ctrl.signal });
    let content = '';
    for await (const part of stream) {
      const piece = part.choices?.[0]?.delta?.content;
      if (piece) {
        content += piece;
        onChars(content.length);
      }
      arm(8_000); // and then a piece every few seconds
    }
    if (stall) clearTimeout(stall);
    content = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const match = content.match(/\{[\s\S]*\}$/);
    if (content) return { content: match ? match[0] : content };
  } catch {
    /* stalled or the provider does not stream: ask for the whole answer below */
  } finally {
    if (stall) clearTimeout(stall);
  }
  const whole = await getOpenAIChatCompletionWithFallback(params, { timeout: options?.timeout ?? 40_000, maxRetries: 0 });
  onChars(Number.MAX_SAFE_INTEGER);
  return { content: whole.content };
}
