// Turns a saved profile into what the live preview draws. Shared by the step-by-step builder and the profile page.
import type { ProfileData } from "@/context/profileContext";
import type { PreviewData } from "@/components/livePreview";
import { placeLine } from "@/lib/place";
import { companyLabel } from "@/lib/selfEmployed";

/** Names the app gives a profile on its own ("Profile 1", the sample "John Doe"): they are not the person's real name. */
export const realName = (n?: string) => (/^(Profile \d+|John Doe)$/i.test((n ?? "").trim()) ? "" : n ?? "");

export function previewFromProfile(profile: ProfileData, lang: "en" | "es" = "en"): PreviewData {
  const firstJob = profile.jobHistory?.[0];
  const firstEdu = profile.education?.[0];
  return {
    links: profile.links ?? [],
    certifications: profile.certifications ?? [],
    interests: profile.interests ?? [],
    projects: (profile.projects ?? []).map((x) => ({
      name: x.name || "",
      link: x.link,
      technologies: x.technologies ?? [],
      startDate: x.startDate || "",
      endDate: x.endDate || "",
      current: Boolean(x.current),
      description: x.description || "",
      bullets: x.accomplishments ?? [],
    })),
    internships: (profile.internships ?? []).map((j) => ({
      company: companyLabel(j, lang),
      title: j.title || "",
      location: j.location || "",
      startDate: j.startDate || "",
      endDate: j.endDate || "",
      current: Boolean(j.current),
      description: j.description || "",
      bullets: j.accomplishments ?? [],
    })),
    sectionOrder: profile.sectionOrder,
    name: realName(profile.name),
    photo: profile.photo,
    email: profile.contactInfo?.email || "",
    phone: profile.contactInfo?.phone || "",
    address: placeLine(profile.contactInfo),
    countryCode: profile.contactInfo?.countryCode || "US",
    jobTitle: profile.jobTitle || "",
    objective: profile.careerObjective || "",
    skills: profile.skills || [],
    languages: profile.languages || [],
    skillLevels: profile.skillLevels || {},
    skillGroups: profile.skillGroups || {},
    accent: profile.accentColor,
    fillPage: profile.fillPage,
    jobs: (profile.jobHistory || []).map((j) => ({
      company: companyLabel(j, lang),
      title: j.title || "",
      location: j.location || "",
      startDate: j.startDate || "",
      endDate: j.endDate || "",
      current: Boolean(j.current),
      description: j.description || "",
      bullets: j.accomplishments || [],
    })),
    job: {
      company: firstJob ? companyLabel(firstJob, lang) : "",
      title: firstJob?.title || "",
      location: firstJob?.location || "",
      startDate: firstJob?.startDate || "",
      endDate: firstJob?.endDate || "",
      current: Boolean(firstJob?.current),
      description: firstJob?.description || "",
      bullets: firstJob?.accomplishments || [],
    },
    edus: (profile.education || []).map((e) => ({
      school: e.school || "",
      degree: e.degree || "",
      location: e.location || "",
      startDate: e.startDate || "",
      endDate: e.endDate || "",
      current: Boolean(e.current),
      gpa: e.gpa || "",
      honors: e.honors || "",
      coursework: e.coursework || "",
    })),
    edu: {
      school: firstEdu?.school || "",
      degree: firstEdu?.degree || "",
      startDate: firstEdu?.startDate || "",
      endDate: firstEdu?.endDate || "",
      current: Boolean(firstEdu?.current),
    },
  };
}
