import OpenAI from 'openai';

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  throw new Error('Missing GITHUB_TOKEN environment variable');
}

const mistral = new OpenAI({
  baseURL: 'https://models.github.ai/inference',
  apiKey: githubToken,
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