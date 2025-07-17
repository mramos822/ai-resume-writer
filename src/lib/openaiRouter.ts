// src/lib/openaiRouter.ts
import { getOpenAIChatCompletion } from './openaiClient';
import { getMistralChatCompletion } from './mistralClient';

// Set your model here
export const MODEL = process.env.AI_MODEL || 'mistral-ai/mistral-medium-2505';

export async function getChatCompletion(params: any) {
  if (MODEL.startsWith('openai/')) {
    return getOpenAIChatCompletion({ ...params, model: MODEL });
  } else if (MODEL.startsWith('mistral-ai/')) {
    return getMistralChatCompletion({ ...params, model: MODEL });
  } else {
    throw new Error('Unknown model provider');
  }
} 