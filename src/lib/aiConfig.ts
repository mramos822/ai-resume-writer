// src/lib/aiConfig.ts
// Single source of truth for the OpenAI-compatible LLM provider (Gemini by default).
export const AI_API_KEY = process.env.AI_API_KEY;
export const AI_BASE_URL =
  process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
export const AI_MODEL = process.env.AI_MODEL || 'gemini-3.5-flash-lite';
