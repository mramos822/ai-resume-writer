import { isSafePublicUrl } from "@/lib/safeUrl";
// src/lib/jobAdText.ts
// The LLM cannot browse, so job-ad URLs are downloaded and stripped to text server-side.

/**
 * LinkedIn job pages need login, but the public guest endpoint returns the posting by job ID.
 * Works for search links (?currentJobId=...) and direct /jobs/view/... links.
 */
function candidateUrls(url: string): string[] {
  if (!/(^|\.)linkedin\.com$/i.test(new URL(url).hostname)) return [url];
  const id =
    /[?&]currentJobId=(\d+)/.exec(url)?.[1] ?? /\/jobs\/view\/(?:[^/?]*-)?(\d+)/.exec(url)?.[1];
  if (!id) return [url];
  return [
    `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`,
    `https://www.linkedin.com/jobs/view/${id}`,
  ];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15000);
}

export async function fetchJobAdText(url: string): Promise<string | null> {
  if (!isSafePublicUrl(url)) return null; // never fetch internal/private addresses
  let targets: string[];
  try {
    targets = candidateUrls(url);
  } catch {
    return null; // not a valid URL
  }

  // Some sites (LinkedIn) throttle intermittently, so retry each target a couple of times
  for (const target of targets) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(target, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ResumeWriter/1.0)" },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const text = htmlToText(await res.text());
          // Login walls and empty pages carry no job description
          if (text.length >= 300 && !/sign in|join now|log in/i.test(text.slice(0, 400))) return text;
        }
      } catch {
        // timeout / network error: fall through to retry
      }
      await sleep(600);
    }
  }
  return null;
}

export const JOB_AD_LINK_ERROR =
  "Could not read that link (the site probably requires login). Paste the job description text instead.";
