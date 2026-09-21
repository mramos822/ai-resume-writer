import type { ProfileData } from "@/context/profileContext";

export type SectionKey = "contact" | "objective" | "skills" | "jobs" | "education";

export interface SectionProgress {
  key: SectionKey;
  label: string;
  weight: number;
  done: boolean;
  /** Short line describing the current state, e.g. "3 added". */
  status: string;
  /** What to do next when this section is not done. */
  hint: string;
}

/** How complete a profile is, weighted by how much each section matters on a resume. */
export function getProfileProgress(profile: ProfileData) {
  const sections: SectionProgress[] = [
    {
      key: "contact",
      label: "Contact info",
      weight: 20,
      done: Boolean(profile.contactInfo?.email),
      status: profile.contactInfo?.email ? "Added" : "Missing",
      hint: "Add your email and phone so employers can reach you",
    },
    {
      key: "objective",
      label: "Objective",
      weight: 15,
      done: Boolean(profile.careerObjective?.trim()),
      status: profile.careerObjective?.trim() ? "Written" : "Missing",
      hint: "Write two lines about the role you want",
    },
    {
      key: "skills",
      label: "Skills",
      weight: 20,
      done: (profile.skills?.length ?? 0) >= 3,
      status: `${profile.skills?.length ?? 0} added`,
      hint: "Add at least three skills",
    },
    {
      key: "jobs",
      label: "Jobs",
      weight: 25,
      done: (profile.jobHistory?.length ?? 0) > 0,
      status: `${profile.jobHistory?.length ?? 0} added`,
      hint: "Add your most recent job",
    },
    {
      key: "education",
      label: "Education",
      weight: 20,
      done: (profile.education?.length ?? 0) > 0,
      status: `${profile.education?.length ?? 0} added`,
      hint: "Add your education",
    },
  ];

  const percent = sections.reduce((sum, s) => sum + (s.done ? s.weight : 0), 0);
  const next = sections.find((s) => !s.done) ?? null;
  return { sections, percent, next, doneCount: sections.filter((s) => s.done).length };
}
