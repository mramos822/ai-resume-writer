// src/context/profileContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "@/context/authContext";
import { useToast } from "@/context/toastContext";
import { formatPeriod } from "@/lib/dateFormat";
import type { LanguageEntry } from "@/lib/languages";
import type { SkillLevels } from "@/lib/skillLevels";
import type { SkillGroups } from "@/lib/skillGroups";
import type { CertificationEntry, LinkEntry } from "@/lib/links";
import { useT } from "@/i18n/provider";

export interface ContactInfo {
  email: string;
  phone: string;
  address: string; // Re-added address to ContactInfo
  city?: string;
  state?: string; // region: state, province, department...
  country?: string;
  countryCode?: string; // ISO code, like "US" or "PE"
  additionalEmails?: string[];
  additionalPhones?: string[];
}

export interface JobEntry {
  id: string;
  company: string;
  title: string;
  location?: string; // city / state, or Remote
  description: string;
  startDate: string;
  endDate: string; // empty while currently working here
  current?: boolean; // currently working here
  selfEmployed?: boolean; // freelance or own business: no employer (the company may hold the name of the business, or "Self-employed")
  accomplishments: string[];
}

export interface EducationEntry {
  id: string;
  school: string;
  degree: string;
  startDate: string; // YYYY-MM
  endDate: string; // YYYY-MM, empty while currently enrolled
  current?: boolean; // currently attending
  dates?: string; // legacy free-text value from older profiles
  gpa?: string;
  location?: string; // city / state
  honors?: string; // e.g. Dean's List, Magna Cum Laude
  coursework?: string; // relevant courses, comma separated
}

/** Human-readable education period, e.g. "Sep 2018 – May 2022" or "Sep 2022 – Present" */
export const formatEducationDates = formatPeriod;

export interface ProjectEntry {
  id: string;
  name: string;
  description: string;
  link?: string;
  technologies: string[];
  startDate: string; // YYYY-MM, optional
  endDate: string; // YYYY-MM, empty while ongoing
  current?: boolean;
  accomplishments: string[];
}

export interface ProfileData {
  name: string; // Added name field
  jobTitle: string; // Added jobTitle field
  photo?: string; // Square JPEG data URL, optional
  /** Only comes with a freshly read resume (never saved): the language the resume was written in, a two-letter code like "de" */
  resumeLanguage?: string;
  languages?: LanguageEntry[]; // spoken languages with a level
  skillLevels?: SkillLevels; // optional 1-5 confidence per skill name
  skillGroups?: SkillGroups; // optional group name per skill ("Languages", "Tools"...)
  accentColor?: string; // id of the color the look wears (see lib/accents)
  /** When true the text grows to fill the page if there is little content; by default it keeps its natural size */
  fillPage?: boolean;
  /** How long the person wants the resume: "one" page (the default), "two" pages, or "any" (it does not matter). Only some looks can run to two pages. */
  pageGoal?: "one" | "two" | "any";
  sectionOrder?: string[]; // order of the resume sections chosen by the person (see lib/sectionOrder)
  /** the level the person confirmed: "entry", "junior", "mid" or "senior" (see lib/experienceLevel) */
  experienceLevel?: "entry" | "junior" | "mid" | "senior";
  links?: LinkEntry[]; // LinkedIn, GitHub, portfolio…
  certifications?: CertificationEntry[];
  /** volunteering, clubs, informal jobs and interests: short lines, for people with little work experience */
  interests?: string[];
  contactInfo: ContactInfo;
  careerObjective: string;
  skills: string[];
  jobHistory: JobEntry[];
  education: EducationEntry[];
  internships: JobEntry[];
  projects: ProjectEntry[];
}

export type ProfileDoc = {
  id: string;
  name: string;
  data: ProfileData;
};

export interface ProfileContextType {
  profiles: ProfileDoc[];
  activeProfileId: string;
  activeProfile: ProfileData & { name: string };
  setActiveProfileId: (id: string) => void;
  /** makes a profile with the given name; fails with code "name-taken" (and the existing profile's id) if that name is already used */
  createProfile: (name?: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  renameProfile: (newName: string) => Promise<void>;
  parseFile: (fileId: string) => Promise<Partial<ProfileData>>;
  /** replaces parts of the active profile (for example with its translation) and saves them right away */
  applyProfileData: (patch: Partial<ProfileData>) => Promise<void>;
  /** loads the active profile again from the server (after something outside the page changed it) */
  reloadProfile: () => Promise<void>;
  saveChanges: () => Promise<void>;
  hasUnsavedChanges: boolean;
  updateContactInfo: (ci: Partial<ContactInfo>) => void;
  updateName: (name: string) => void; // Added updateName
  updateJobTitle: (jobTitle: string) => void; // Added updateJobTitle
  updatePhoto: (photo: string) => void; // "" removes the photo
  setJobHistory: (jobs: JobEntry[]) => void; // replaces the whole list in one update
  setEducation: (list: EducationEntry[]) => void; // same, for schools
  updateLanguages: (list: LanguageEntry[]) => void;
  updateSkillLevels: (levels: SkillLevels) => void;
  updateSkillGroups: (groups: SkillGroups) => void;
  updateAccentColor: (id: string) => void;
  updateFillPage: (on: boolean) => void;
  updatePageGoal: (goal: "one" | "two" | "any") => void;
  updateSectionOrder: (order: string[]) => void;
  updateLinks: (list: LinkEntry[]) => void;
  updateCertifications: (list: CertificationEntry[]) => void;
  updateInterests: (list: string[]) => void;
  updateCareerObjective: (obj: string) => void;
  updateSkills: (skills: string[]) => void;
  addJobEntry: (job: Omit<JobEntry, "id">) => void;
  updateJobEntry: (id: string, job: Partial<JobEntry>) => void;
  deleteJobEntry: (id: string) => void;
  addEducationEntry: (edu: Omit<EducationEntry, "id">) => void;
  updateEducationEntry: (id: string, edu: Partial<EducationEntry>) => void;
  deleteEducationEntry: (id: string) => void;
  addInternshipEntry: (internship: Omit<JobEntry, "id">) => void;
  updateInternshipEntry: (id: string, internship: Partial<JobEntry>) => void;
  deleteInternshipEntry: (id: string) => void;
  addProjectEntry: (project: Omit<ProjectEntry, "id">) => void;
  updateProjectEntry: (id: string, project: Partial<ProjectEntry>) => void;
  deleteProjectEntry: (id: string) => void;
}

const EMPTY_PROFILE: ProfileData = {
  name: "", // Initialized name
  jobTitle: "", // Initialized jobTitle
  contactInfo: { email: "", phone: "", address: "" }, // Initialized address
  careerObjective: "",
  skills: [],
  jobHistory: [],
  education: [],
  internships: [],
  projects: [],
};

const ProfileContext = createContext<ProfileContextType | undefined>(
  undefined
);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { tr, trd } = useT();
  const { user, loading } = useAuth();
  const toast = useToast();
  const [profiles, setProfiles] = useState<ProfileDoc[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [profileData, setProfileData] = useState<ProfileData>(
    EMPTY_PROFILE
  );
  const [profileName, setProfileName] = useState<string>(""); // keep name too
  const [hasUnsavedChanges, setHasUnsavedChanges] =
    useState<boolean>(false);

  // Fetch list of profiles
  const loadProfiles = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/profiles", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(tr("Failed to load profiles"));
    const list = (await res.json()) as ProfileDoc[];
    setProfiles(list);
    if (!activeProfileId && list.length > 0) {
      // Which profile opens: the one that holds the resume the person just moved to their account (from the builder), else the one they
      // were last working on in this account, else the first.
      let pick = list[0];
      try {
        const hint = sessionStorage.getItem("kaizo_open_profile");
        const last = localStorage.getItem(`kaizo_last_profile:${user.uid}`);
        if (hint) sessionStorage.removeItem("kaizo_open_profile");
        pick = (hint && list.find((p) => p.id === hint)) || (last && list.find((p) => p.id === last)) || pick;
      } catch {
        /* storage unavailable */
      }
      setActiveProfileId(pick.id);
      setProfileName(pick.name);
      setProfileData(pick.data);
    }
  }, [user, activeProfileId, tr]);

  // the profile being worked on is remembered per account, so the dashboard opens on it the next time
  useEffect(() => {
    if (!activeProfileId || !user) return;
    try {
      localStorage.setItem(`kaizo_last_profile:${user.uid}`, activeProfileId);
    } catch {
      /* storage unavailable */
    }
  }, [activeProfileId, user]);

  // Whenever activeProfileId changes, fetch its data
  useEffect(() => {
    if (!activeProfileId || !user) return;
    let stale = false;
    (async () => {
      const token = await user.getIdToken();
      const res = await fetch(`/api/profiles/${activeProfileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (stale) return;
      if (res.status === 404) {
        // that profile no longer exists (deleted, or it belonged to another session): start again from the person's own list
        setActiveProfileId("");
        setProfileData(EMPTY_PROFILE);
        setHasUnsavedChanges(false);
        return;
      }
      if (!res.ok) throw new Error(tr("Failed to load profile"));
      const doc = (await res.json()) as ProfileDoc;
      setProfileName(doc.name);
      setProfileData(doc.data);
      setHasUnsavedChanges(false);
    })().catch((err) => console.error(err));
    return () => {
      stale = true;
    };
  }, [activeProfileId, user, tr]);

  // another person signed in (a new guest, a different account): nothing of the previous one stays selected
  const uid = user?.uid ?? "";
  const lastUid = useRef(uid);
  useEffect(() => {
    if (lastUid.current === uid) return;
    lastUid.current = uid;
    setActiveProfileId("");
    setProfiles([]);
    setProfileData(EMPTY_PROFILE);
    setHasUnsavedChanges(false);
  }, [uid]);

  // Initial load
  useEffect(() => {
    if (!loading) {
      loadProfiles().catch(console.error);
    }
  }, [loading, loadProfiles]);

  const markUnsaved = () => setHasUnsavedChanges(true);

  const updateField = <K extends keyof ProfileData>(
    key: K,
    value: ProfileData[K]
  ) => {
    setProfileData((prev) => ({ ...prev, [key]: value }));
    markUnsaved();
  };

  const createProfile = useCallback(async (name?: string) => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, ...(name !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(name !== undefined ? { body: JSON.stringify({ name }) } : {}),
    });
    if (!res.ok) {
      const info = (await res.json().catch(() => ({}))) as { error?: string; id?: string; name?: string };
      if (info.error === "name-taken" || info.error === "name-empty") throw Object.assign(new Error(info.error), { code: info.error, id: info.id, name: info.name });
      throw new Error(tr("Create failed"));
    }
    const doc = (await res.json()) as { id: string; name: string };
    setActiveProfileId(doc.id);
    await loadProfiles();
  }, [user, loadProfiles, tr]);

  const deleteProfile = useCallback(
    async (id: string) => {
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(`/api/profiles/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(tr("Delete failed"));
      if (id === activeProfileId) {
        setActiveProfileId("");
      }
      await loadProfiles();
    },
    [user, activeProfileId, loadProfiles]
  );

  const renameProfile = useCallback(
    async (newName: string) => {
      if (!user || !activeProfileId) return;
      const token = await user.getIdToken();
      const res = await fetch(`/api/profiles/${activeProfileId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error(tr("Rename failed"));
      await loadProfiles();
    },
    [user, activeProfileId, loadProfiles]
  );

  const saveChanges = useCallback(async () => {
    if (!user || !activeProfileId) return;
    const token = await user.getIdToken();
    const res = await fetch(`/api/profiles/${activeProfileId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ data: profileData }),
    });
    if (!res.ok) throw new Error(tr("Save failed"));
    setHasUnsavedChanges(false);
    await loadProfiles();
  }, [user, activeProfileId, profileData, loadProfiles, tr]);

  const reloadProfile = useCallback(async () => {
    if (!user || !activeProfileId) return;
    const token = await user.getIdToken();
    const res = await fetch(`/api/profiles/${activeProfileId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(tr("Failed to reload profile"));
    const doc = (await res.json()) as ProfileDoc;
    setProfileName(doc.name);
    setProfileData(doc.data);
    await loadProfiles();
  }, [user, activeProfileId, loadProfiles, tr]);

  const parseFile = useCallback(
    async (fileId: string): Promise<Partial<ProfileData>> => {
      if (!user || !activeProfileId) return {};
      const token = await user.getIdToken();
      // send JSON; parse-route expects jSON { fileId }
      const res = await fetch(`/api/profiles/${activeProfileId}/parse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileId }),
      });
      if (!res.ok) {
        // say why: the server answers with the reason (the AI was busy, the file could not be read, too many tries...)
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        console.error("Parse failed", res.status, data.error);
        const why = res.status === 429 ? tr("We are very busy right now. Please try again in a minute.") : data.error ? trd(data.error) : "";
        throw new Error(why ? `${tr("Parse failed")}: ${why}` : tr("Parse failed"));
      }
      // the language the resume was written in comes only in this answer (it is not saved): it is handed back with the data
      const readLanguage = ((await res.json().catch(() => ({}))) as { resumeLanguage?: unknown }).resumeLanguage;
      // After parsing, refetch the profile to get updated name and data
      const profileRes = await fetch(`/api/profiles/${activeProfileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!profileRes.ok) throw new Error(tr("Failed to reload profile after parsing"));
      const doc = (await profileRes.json()) as ProfileDoc;
      setProfileName(doc.name);
      setProfileData(doc.data);
      setHasUnsavedChanges(true);
      await loadProfiles(); // refresh the profile selector with the new name
      toast.success(tr("Finished parsing file!"));
      return typeof readLanguage === "string" && readLanguage ? { ...doc.data, resumeLanguage: readLanguage } : doc.data;
    },
    [user, activeProfileId, toast, loadProfiles]
  );

  const applyProfileData = useCallback(
    async (patch: Partial<ProfileData>) => {
      if (!user || !activeProfileId) return;
      const merged = { ...profileData, ...patch } as ProfileData;
      setProfileData(merged);
      const token = await user.getIdToken();
      const res = await fetch(`/api/profiles/${activeProfileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: merged }),
      });
      if (!res.ok) throw new Error(tr("Save failed"));
      setHasUnsavedChanges(false);
    },
    [user, activeProfileId, profileData]
  );

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfileId,
        activeProfile: {
          ...profileData,
          internships: profileData.internships ?? [],
          projects: profileData.projects ?? [],
          // The name of the person is the one written in Contact (first and last name, saved in the data), the same one the server puts on the
          // resume. The name of the profile itself ("Profile 1") only stands in while none is written.
          name: profileData.name?.trim() ? profileData.name : profileName,
        },
        setActiveProfileId,
        createProfile,
        deleteProfile,
        renameProfile,
        parseFile,
        applyProfileData,
        reloadProfile,
        saveChanges,
        hasUnsavedChanges,
        updateContactInfo: (ci) =>
          updateField("contactInfo", { ...profileData.contactInfo, ...ci }),
        updateName: (n) => updateField("name", n), // Implemented updateName
        updateJobTitle: (jt) => updateField("jobTitle", jt), // Implemented updateJobTitle
        updatePhoto: (ph) => updateField("photo", ph),
        setJobHistory: (jobs) => updateField("jobHistory", jobs),
        setEducation: (list) => updateField("education", list),
        updateLanguages: (list) => updateField("languages", list),
        updateSkillLevels: (lv) => updateField("skillLevels", lv),
        updateSkillGroups: (g) => updateField("skillGroups", g),
        updateAccentColor: (id) => updateField("accentColor", id),
        updateFillPage: (on) => updateField("fillPage", on),
        updatePageGoal: (goal) => updateField("pageGoal", goal),
        updateSectionOrder: (o) => updateField("sectionOrder", o),
        updateLinks: (list) => updateField("links", list),
        updateCertifications: (list) => updateField("certifications", list),
        updateInterests: (list) => updateField("interests", list),
        updateCareerObjective: (o) => updateField("careerObjective", o),
        updateSkills: (s) => updateField("skills", s),
        addJobEntry: (job) =>
          updateField("jobHistory", [
            ...profileData.jobHistory,
            { ...job, id: Date.now().toString() },
          ]),
        updateJobEntry: (id, j) =>
          updateField(
            "jobHistory",
            profileData.jobHistory.map((e) =>
              e.id === id ? { ...e, ...j } : e
            )
          ),
        deleteJobEntry: (id) =>
          updateField(
            "jobHistory",
            profileData.jobHistory.filter((e) => e.id !== id)
          ),
        addEducationEntry: (ed) =>
          updateField("education", [
            ...profileData.education,
            { ...ed, id: Date.now().toString() },
          ]),
        updateEducationEntry: (id, e) =>
          updateField(
            "education",
            profileData.education.map((x) =>
              x.id === id ? { ...x, ...e } : x
            )
          ),
        deleteEducationEntry: (id) =>
          updateField(
            "education",
            profileData.education.filter((x) => x.id !== id)
          ),
        addInternshipEntry: (internship) =>
          updateField("internships", [
            ...profileData.internships,
            { ...internship, id: Date.now().toString() },
          ]),
        updateInternshipEntry: (id, i) =>
          updateField(
            "internships",
            profileData.internships.map((e) =>
              e.id === id ? { ...e, ...i } : e
            )
          ),
        addProjectEntry: (project) =>
          updateField("projects", [
            ...(profileData.projects ?? []),
            { ...project, id: Date.now().toString() },
          ]),
        updateProjectEntry: (id, pr) =>
          updateField(
            "projects",
            (profileData.projects ?? []).map((e) =>
              e.id === id ? { ...e, ...pr } : e
            )
          ),
        deleteProjectEntry: (id) =>
          updateField(
            "projects",
            (profileData.projects ?? []).filter((e) => e.id !== id)
          ),
        deleteInternshipEntry: (id) =>
          updateField(
            "internships",
            profileData.internships.filter((e) => e.id !== id)
          ),
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextType {
  const { tr } = useT();
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error(tr("useProfile must be inside ProfileProvider"));
  }
  return ctx;
}

/**
 * A copy of the profile to edit for ONE purpose (a resume for a job). The editors of the profile work on it exactly as they do on
 * the saved profile, but nothing is saved: the saved profile never changes.
 */
export function ProfileDraftProvider({ initial, children }: { initial: ProfileData; children: ReactNode }) {
  const real = useProfile();
  const [draft, setDraft] = useState<ProfileData>(initial);
  const set = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => setDraft((p) => ({ ...p, [key]: value }));
  const withId = <T,>(item: T) => ({ ...item, id: Date.now().toString() + Math.random().toString(36).slice(2, 5) });
  const list = <K extends "jobHistory" | "education" | "internships" | "projects">(key: K) => ({
    add: (item: Omit<NonNullable<ProfileData[K]>[number], "id">) => setDraft((p) => ({ ...p, [key]: [...((p[key] as unknown[]) ?? []), withId(item)] })),
    update: (id: string, patch: object) => setDraft((p) => ({ ...p, [key]: ((p[key] as { id: string }[]) ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
    remove: (id: string) => setDraft((p) => ({ ...p, [key]: ((p[key] as { id: string }[]) ?? []).filter((e) => e.id !== id) })),
  });
  const jobs = list("jobHistory");
  const edu = list("education");
  const interns = list("internships");
  const projs = list("projects");

  const value: ProfileContextType = {
    ...real,
    activeProfile: { ...draft, internships: draft.internships ?? [], projects: draft.projects ?? [], name: draft.name || real.activeProfile.name },
    hasUnsavedChanges: false,
    saveChanges: async () => {},
    reloadProfile: async () => {},
    applyProfileData: async (patch) => {
      setDraft((p) => ({ ...p, ...patch }));
      // the level is a fact about the person, not an edit for one job: it is saved in the real profile too
      if ("experienceLevel" in patch) await real.applyProfileData({ experienceLevel: patch.experienceLevel });
    },
    updateContactInfo: (ci) => setDraft((p) => ({ ...p, contactInfo: { ...p.contactInfo, ...ci } })),
    updateName: (n) => set("name", n),
    updateJobTitle: (jt) => set("jobTitle", jt),
    updatePhoto: (ph) => set("photo", ph),
    setJobHistory: (l) => set("jobHistory", l),
    setEducation: (l) => set("education", l),
    updateLanguages: (l) => set("languages", l),
    updateSkillLevels: (lv) => set("skillLevels", lv),
    updateSkillGroups: (g) => set("skillGroups", g),
    updateAccentColor: (id) => set("accentColor", id),
    updateFillPage: (on) => set("fillPage", on),
    updatePageGoal: (goal) => set("pageGoal", goal),
    updateSectionOrder: (o) => set("sectionOrder", o),
    updateLinks: (l) => set("links", l),
    updateCertifications: (l) => set("certifications", l),
    updateInterests: (l) => set("interests", l),
    updateCareerObjective: (o) => set("careerObjective", o),
    updateSkills: (s) => set("skills", s),
    addJobEntry: jobs.add,
    updateJobEntry: jobs.update,
    deleteJobEntry: jobs.remove,
    addEducationEntry: edu.add,
    updateEducationEntry: edu.update,
    deleteEducationEntry: edu.remove,
    addInternshipEntry: interns.add,
    updateInternshipEntry: interns.update,
    deleteInternshipEntry: interns.remove,
    addProjectEntry: projs.add,
    updateProjectEntry: projs.update,
    deleteProjectEntry: projs.remove,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
