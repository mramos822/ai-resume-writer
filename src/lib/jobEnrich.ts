// The job boards share only the start of a posting (Adzuna: about 500 characters, cut with "…"). A fit worked out from it is a guess: the
// skills and the experience a job asks for are mostly further down. So the search reads the whole posting of the listings that came cut, and
// the number in the list is the same one the page of the job (and "Add a job") gives.
import { HttpError } from "@/lib/apiAuth";
import { fetchJobAdText } from "@/lib/jobAdText";
import { isPartialPosting, type JobListing } from "@/lib/jobSearch";
import { isSafePublicUrl } from "@/lib/safeUrl";

const cache = new Map<string, { at: number; text: string | null }>();
const TTL = 6 * 60 * 60 * 1000;

/** The text of the posting from its own page. Only a page that publishes the posting as structured data (it starts with "Title:") is trusted:
 *  a plain page also holds menus and "similar jobs", whose words would count as skills of this job. */
async function readWhole(job: JobListing): Promise<string | null> {
  const hit = cache.get(job.key);
  if (hit && Date.now() - hit.at < TTL) return hit.text;
  let text: string | null = null;
  try {
    const page = job.url && isSafePublicUrl(job.url) ? await fetchJobAdText(job.url, true, 1) : null;
    if (page && /^Title: /.test(page)) text = page.replace(/^(?:(?:Title|Company|Location|Posted): [^\n]*\n)+\s*/, "").replace(/\s*\n\s*/g, " ").trim();
  } catch {
    text = null;
  }
  if (cache.size > 800) cache.delete(cache.keys().next().value as string);
  cache.set(job.key, { at: Date.now(), text });
  return text;
}

/**
 * Gives the listings that came cut their whole text. At most `max` are read, a few at a time, and whatever is not read within `budgetMs`
 * stays as it was (the list then shows its number as an estimate, and the page of the job reads it when opened).
 */
export async function enrichListings(jobs: JobListing[], max = 40, budgetMs = 4500): Promise<JobListing[]> {
  const todo = jobs.filter(isPartialPosting).slice(0, max);
  if (todo.length === 0) return jobs;
  const whole = new Map<string, string>();
  const stop = Date.now() + budgetMs;
  const queue = [...todo];
  const worker = async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      if (Date.now() > stop) return;
      const text = await readWhole(j);
      if (text && text.length > (j.description ?? "").length) whole.set(j.key, text.slice(0, 3500));
    }
  };
  await Promise.race([Promise.all(Array.from({ length: 20 }, worker)), new Promise((r) => setTimeout(r, budgetMs + 500))]);
  return jobs.map((j) => (whole.has(j.key) ? { ...j, description: whole.get(j.key) } : j));
}

export const CUT_POSTING_ERROR = "We couldn't read the whole job posting, and a resume made from half of it would miss what the job asks for. Use Add a job and paste the text of the posting.";

/**
 * The job with its whole text, for what is written FROM it (the questions, the tailored resume, the letter): a job that came cut is read from
 * its page, and if that cannot be done the work stops with a clear message instead of using half a posting.
 */
export async function wholeJob(job: JobListing): Promise<JobListing> {
  if (!isPartialPosting(job)) return job;
  const [read] = await enrichListings([job], 1, 8000);
  if (isPartialPosting(read)) throw new HttpError(422, CUT_POSTING_ERROR);
  return read;
}
