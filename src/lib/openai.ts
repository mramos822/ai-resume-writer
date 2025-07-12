import OpenAI from "openai";

// Read & validate the GitHub token
const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  throw new Error("Missing GITHUB_TOKEN environment variable");
}

// Initialize the OpenAI client with GitHub token and base URL
export const openai = new OpenAI({ 
  baseURL: "https://models.github.ai/inference",
  apiKey: githubToken 
});

// Model constant
export const MODEL = "openai/gpt-4o-mini";
