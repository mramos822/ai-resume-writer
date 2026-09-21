// src/lib/openaiRouter.ts
import { getOpenAIChatCompletion } from './openaiClient';
import { AI_MODEL } from './aiConfig';

// Model is configured via AI_MODEL (see aiConfig.ts)
export const MODEL = AI_MODEL;

export async function getChatCompletion(params: any) {
  return getOpenAIChatCompletion({ ...params, model: MODEL });
}
