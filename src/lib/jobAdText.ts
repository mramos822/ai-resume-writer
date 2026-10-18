import { isSafePublicUrl } from "@/lib/safeUrl";
import { structuredPay } from "@/lib/ingest/pay";
// src/lib/jobAdText.ts
// The LLM cannot browse, so job-ad URLs are downloaded and stripped to text server-side.

/**
 * LinkedIn job pages need login, but the public guest endpoint returns the posting by job ID.
 * Works for search links (?currentJobId=...) and direct /jobs/view/... links.
 */
function candidateUrls(url: string): string[] {
  // Adzuna's link goes through a page that only forwards to the employer; the same posting is complete (and readable) at /details/<id>
  const adz = /^https?:\/\/(?:www\.)?adzuna\.[a-z.]+\/land\/ad\/(\d+)/i.exec(url);
  if (adz) return [`${new URL(url).origin}/details/${adz[1]}`, url];
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

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "'", lsquo: "'", ndash: "-", mdash: "-", bull: "•" };
export const decode = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " ";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** The page as text. `keepLines` keeps paragraphs and list items on their own lines, so the AI can tell what is a list. */
export function htmlToText(html: string, keepLines = false): string {
  let h = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->|<(nav|header|footer|aside|form|svg|noscript)\b[\s\S]*?<\/\1>/gi, " ");
  if (keepLines) h = h.replace(/<li\b[^>]*>/gi, "\n- ").replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|section)>|<br\s*\/?>/gi, "\n");
  h = decode(h.replace(/<[^>]+>/g, " "));
  h = keepLines ? h.replace(/[ \t\f\r]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n") : h.replace(/\s+/g, " ");
  return h.trim().slice(0, 15000);
}

/** The posting itself, without menus or "similar jobs", when the page says where it is. */
function postingOf(html: string): string | null {
  // structured data that many job boards and company pages publish for search engines
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const nodes: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.["@graph"]) ? data["@graph"] : [data];
      const job = nodes.find((x) => x && typeof x === "object" && /JobPosting/i.test(String((x as { "@type"?: unknown })["@type"]))) as Record<string, unknown> | undefined;
      if (!job || typeof job.description !== "string") continue;
      const org = job.hiringOrganization as { name?: unknown } | undefined;
      const address = (job.jobLocation as { address?: { addressLocality?: unknown; addressRegion?: unknown } } | undefined)?.address;
      const where = [address?.addressLocality, address?.addressRegion].filter((x) => typeof x === "string" && x).join(", ");
      // the pay the page publishes in its data (many job boards do: "baseSalary": PEN 1530 per month); the AI and the pay reader see it as a line
      const sal = job.baseSalary as { currency?: unknown; value?: { value?: unknown; minValue?: unknown; maxValue?: unknown; unitText?: unknown } | number } | undefined;
      const salVal = sal && typeof sal.value === "object" && sal.value ? sal.value : undefined;
      const pay = sal ? structuredPay(sal.currency, salVal?.minValue ?? salVal?.value ?? sal.value, salVal?.maxValue ?? salVal?.value ?? sal.value, salVal?.unitText) : undefined;
      const head = [`Title: ${String(job.title ?? "")}`, org?.name ? `Company: ${String(org.name)}` : "", where ? `Location: ${where}` : "", job.datePosted ? `Posted: ${String(job.datePosted)}` : "", pay ? `Salary: ${pay}` : ""].filter(Boolean);
      return `${head.join("\n")}\n\n${htmlToText(decode(job.description), true)}`;
    } catch {
      /* not valid JSON: next block */
    }
  }
  // Adzuna's own page of a posting (when it has no structured data): the description is the block "adp-body"
  const adzunaBody = /<section[^>]+class="[^"]*\badp-body\b[^"]*"[^>]*>([\s\S]*?)<\/section>/i.exec(html)?.[1];
  if (adzunaBody) {
    const title = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
    if (title) return `Title: ${htmlToText(title)}\n\n${htmlToText(adzunaBody, true)}`;
  }
  // LinkedIn's public posting: title, company and place on top, then the block with the description
  const body = /<div[^>]+class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1];
  if (body) {
    const title = /<h[12][^>]*class="[^"]*top-card-layout__title[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i.exec(html)?.[1];
    const company = /<a[^>]+class="[^"]*topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(html)?.[1];
    const place = /<span[^>]+class="[^"]*topcard__flavor topcard__flavor--bullet[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1];
    const head = [title && `Title: ${htmlToText(title)}`, company && `Company: ${htmlToText(company)}`, place && `Location: ${htmlToText(place)}`].filter(Boolean);
    return `${head.join("\n")}\n\n${htmlToText(body, true)}`;
  }
  return null;
}

/** The main block of a page (its <main>, or its biggest <article>), when it is there and has some body; null otherwise. */
export function mainBlock(html: string): string | null {
  const blocks = [...html.matchAll(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]);
  const best = blocks.sort((a, b) => b.length - a.length)[0];
  return best && htmlToText(best).length >= 400 ? best : null;
}

/** A page that is a check for people ("Just a moment...", a captcha), not the posting: the site does not let programs read its pages. */
const HUMAN_CHECK = /just a moment|enable javascript and cookies|cf-chl|challenge-platform|captcha|verify you are (?:a )?human|are you a robot|access denied/i;

export async function fetchJobAdText(url: string, keepLines = false, tries = 3): Promise<string | null> {
  return (await fetchJobAdPage(url, keepLines, tries)).text;
}

/**
 * The text of the posting, and whether the site turned the request away with a check for people (Cloudflare and the like). That is respected: it
 * is not insisted on and not worked around; the person is told to paste the text.
 */
export async function fetchJobAdPage(url: string, keepLines = false, tries = 3): Promise<{ text: string | null; blocked: boolean }> {
  if (!isSafePublicUrl(url)) return { text: null, blocked: false }; // never fetch internal/private addresses
  let targets: string[];
  try {
    targets = candidateUrls(url);
  } catch {
    return { text: null, blocked: false }; // not a valid URL
  }

  // Some sites (LinkedIn) throttle intermittently, so retry each target a couple of times
  for (const target of targets) {
    for (let attempt = 0; attempt < tries; attempt++) {
      try {
        const res = await fetch(target, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ResumeWriter/1.0)" },
          signal: AbortSignal.timeout(8000),
        });
        // 401, 403 and 429 are the site saying no to a program (Indeed answers 401, OCC and Glassdoor 403): it is not insisted on. A 503 only when it is a check.
        if (res.status === 401 || res.status === 403 || res.status === 429) return { text: null, blocked: true };
        if (res.status === 503) {
          const body = await res.text().catch(() => "");
          if (res.headers.get("cf-mitigated") === "challenge" || HUMAN_CHECK.test(body.slice(0, 4000))) return { text: null, blocked: true };
        }
        if (res.ok) {
          const html = await res.text();
          const posting = keepLines ? postingOf(html) : null;
          // without data of its own, the main block of the page (its <main> or <article>) is read, not the menus around it
          const text = posting && posting.length >= 200 ? posting : htmlToText(mainBlock(html) ?? html, keepLines);
          if (HUMAN_CHECK.test(text.slice(0, 300))) return { text: null, blocked: true };
          // Login walls and empty pages carry no job description
          if (text.length >= 300 && !/sign in|join now|log in/i.test(text.slice(0, 400))) return { text, blocked: false };
        }
      } catch {
        // timeout / network error: fall through to retry
      }
      await sleep(600);
    }
  }
  return { text: null, blocked: false };
}

export const JOB_AD_BLOCKED_ERROR =
  "That site doesn't let programs read its pages (it asks for a check that only a person can pass). Open the job in your browser, copy its text and paste it in \"Paste the text\".";

export const JOB_AD_LINK_ERROR =
  "Could not read that link (the site probably requires login). Paste the job description text instead.";
