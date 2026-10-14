// src/lib/aiConfig.ts
// Single source of truth for the OpenAI-compatible LLM provider (Gemini by default).
export const AI_API_KEY = process.env.AI_API_KEY;
export const AI_BASE_URL =
  process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
export const AI_MODEL = process.env.AI_MODEL || 'gemini-3.5-flash-lite';
// The model for what decides the person's trust: judging a resume against a job, rewriting it, writing the cover letter. It can be a
// stronger (slower, dearer) model than AI_MODEL, which stays for the quick jobs (short questions, reading, sorting). When AI_MODEL_STRONG
// is not set, everything uses AI_MODEL, as before.
export const AI_MODEL_STRONG = process.env.AI_MODEL_STRONG || AI_MODEL;
