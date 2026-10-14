import type { PreviewData, PreviewEdu, PreviewJob } from "@/components/livePreview";
import { toBullets } from "@/lib/bullets";
import { fullState, placeLine } from "@/lib/place";

/** What the step-by-step builder keeps in the browser (a part of it: what the sheet and the summary need). */
export interface SavedDraft {
  savedAt?: number;
  name?: string;
  photo?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  jobTitle?: string;
  objective?: string;
  skills?: string[];
  languages?: PreviewData["languages"];
  skillLevels?: PreviewData["skillLevels"];
  skillGroups?: PreviewData["skillGroups"];
  jobs?: (Omit<PreviewJob, "bullets"> & { id?: string })[];
  edus?: (PreviewEdu & { id?: string })[];
}

const blankJob: PreviewJob = { company: "", title: "", startDate: "", endDate: "", current: false, description: "" };
const blankEdu: PreviewEdu = { school: "", degree: "", startDate: "", endDate: "", current: false };

/** The unfinished resume as the sheet draws it, so the person sees their own resume when they come back. */
export function draftToPreview(d: SavedDraft, accent?: string): PreviewData {
  const jobs = (d.jobs ?? []).map((j) => ({ ...j, description: "", bullets: toBullets(j.description ?? "") }));
  const edus = d.edus ?? [];
  return {
    name: d.name ?? "",
    photo: d.photo || undefined,
    email: d.email ?? "",
    phone: d.phone ?? "",
    address: placeLine({ address: d.address ?? "", city: d.city ?? "", state: d.countryCode === "US" ? fullState(d.state ?? "") : d.state ?? "", country: d.country ?? "", countryCode: d.countryCode ?? "" }),
    countryCode: d.countryCode,
    jobTitle: d.jobTitle ?? "",
    objective: d.objective ?? "",
    skills: d.skills ?? [],
    languages: d.languages,
    skillLevels: d.skillLevels,
    skillGroups: d.skillGroups,
    accent,
    jobs,
    job: jobs[0] ?? blankJob,
    edus,
    edu: edus[0] ?? blankEdu,
  };
}
