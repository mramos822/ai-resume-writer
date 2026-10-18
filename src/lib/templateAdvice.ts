// Looks (templates) worth considering for a job and a resume: the ones that suit the field of the job, the safe one for ATS, and how
// the resume sits on the page in each (the page filter of a recruiter, see pageRules). The person decides; nothing is changed here.
import type { ProfileData } from "@/context/profileContext";
import type { ResumeLang } from "@/lib/dateFormat";
import type { JobListing } from "@/lib/jobSearch";
import { renderResumeDetailed } from "@/lib/pdfResume";
import { passesPage } from "@/lib/pageRules";
import { TEMPLATES, isTemplateId, type TemplateId } from "@/lib/templates";
import { fieldFromText, type LookField } from "@/lib/jobField";

export type { LookField };

const LOOKS: Record<LookField, TemplateId[]> = {
  tech: ["tech", "modern", "essential", "minimal"],
  creative: ["creative", "atelier", "pastel", "modern"],
  business: ["executive", "corporate", "elegant", "legal", "classic"],
  health: ["health", "classic", "essential"],
  academic: ["academic", "elegant", "classic"],
  general: ["essential", "classic", "minimal", "modern"],
};

export interface LookAdvice {
  id: TemplateId;
  name: string;
  /** why it is offered: the field it suits, or the safe choice for ATS */
  field: LookField;
  safe: boolean;
  scale: number;
  pages: number;
  passes: boolean;
  current: boolean;
}

/** The field of a job, from its title and tags first and then its text. */
export function fieldOf(job: JobListing): { field: LookField; looks: TemplateId[] } {
  const field = fieldFromText(`${job.title} ${job.tags.join(" ")}`) || fieldFromText(job.description || job.snippet || "") || "general";
  return { field, looks: LOOKS[field] };
}

/** The plain one-column looks an applicant tracking system reads without trouble: always offered, whatever the field. */
const SAFE: TemplateId[] = ["essential", "classic", "ats"];

/** Up to six looks for this job, each measured with this resume: the best three for its field and the ATS-safe ones. */
export async function adviseLooks(profile: ProfileData, job: JobListing, current: string, lang: ResumeLang): Promise<{ field: LookField; looks: LookAdvice[] }> {
  const { field, looks } = fieldOf(job);
  const ids = Array.from(new Set<TemplateId>([...looks.slice(0, 3), ...SAFE, ...(isTemplateId(current) ? [current] : [])])).slice(0, 7);
  const out: LookAdvice[] = [];
  for (const id of ids) {
    try {
      const r = await renderResumeDetailed(profile, id, { lang });
      out.push({ id, name: (TEMPLATES.find((t) => t.id === id)?.name ?? id).replace(" (Default)", ""), field, safe: SAFE.includes(id), scale: r.scale, pages: r.pages, passes: passesPage({ pages: r.pages, scale: r.scale, maxPages: r.maxPages }), current: id === current });
    } catch {
      /* a look that cannot be measured is left out */
    }
  }
  // the ones that pass the page first, in the order of how well they suit the job; the current one stays in its place
  const order = (l: LookAdvice) => ids.indexOf(l.id);
  out.sort((a, b) => Number(b.passes) - Number(a.passes) || order(a) - order(b));
  return { field, looks: out.slice(0, 6) };
}
