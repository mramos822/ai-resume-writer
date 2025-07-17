// src/context/profileContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "@/context/authContext";
import { useToast } from "@/context/toastContext";

export interface ContactInfo {
  email: string;
  phone: string;
  address: string; // Re-added address to ContactInfo
  additionalEmails?: string[];
  additionalPhones?: string[];
}

export interface JobEntry {
  id: string;
  company: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  accomplishments: string[];
}

export interface EducationEntry {
  id: string;
  school: string;
  degree: string;
  dates: string;
  gpa?: string;
}

export interface ProfileData {
  name: string; // Added name field
  jobTitle: string; // Added jobTitle field
  contactInfo: ContactInfo;
  careerObjective: string;
  skills: string[];
  jobHistory: JobEntry[];
  education: EducationEntry[];
  internships: JobEntry[];
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
  createProfile: () => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  renameProfile: (newName: string) => Promise<void>;
  parseFile: (fileId: string) => Promise<Partial<ProfileData>>;
  saveChanges: () => Promise<void>;
  hasUnsavedChanges: boolean;
  updateContactInfo: (ci: Partial<ContactInfo>) => void;
  updateName: (name: string) => void; // Added updateName
  updateJobTitle: (jobTitle: string) => void; // Added updateJobTitle
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
};

const ProfileContext = createContext<ProfileContextType | undefined>(
  undefined
);

export function ProfileProvider({ children }: { children: ReactNode }) {
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
    if (!res.ok) throw new Error("Failed to load profiles");
    const list = (await res.json()) as ProfileDoc[];
    setProfiles(list);
    if (!activeProfileId && list.length > 0) {
      setActiveProfileId(list[0].id);
      setProfileName(list[0].name);
      setProfileData(list[0].data);
    }
  }, [user, activeProfileId]);

  // Whenever activeProfileId changes, fetch its data
  useEffect(() => {
    if (!activeProfileId || !user) return;
    (async () => {
      const token = await user.getIdToken();
      const res = await fetch(`/api/profiles/${activeProfileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load profile");
      const doc = (await res.json()) as ProfileDoc;
      setProfileName(doc.name);
      setProfileData(doc.data);
      setHasUnsavedChanges(false);
    })();
  }, [activeProfileId, user]);

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

  const createProfile = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Create failed");
    const doc = (await res.json()) as { id: string; name: string };
    setActiveProfileId(doc.id);
    await loadProfiles();
  }, [user, loadProfiles]);

  const deleteProfile = useCallback(
    async (id: string) => {
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(`/api/profiles/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
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
      if (!res.ok) throw new Error("Rename failed");
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
    if (!res.ok) throw new Error("Save failed");
    setHasUnsavedChanges(false);
    await loadProfiles();
  }, [user, activeProfileId, profileData, loadProfiles]);

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
      if (!res.ok) throw new Error("Parse failed");
      // After parsing, refetch the profile to get updated name and data
      const profileRes = await fetch(`/api/profiles/${activeProfileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!profileRes.ok) throw new Error("Failed to reload profile after parsing");
      const doc = (await profileRes.json()) as ProfileDoc;
      setProfileName(doc.name);
      setProfileData(doc.data);
      setHasUnsavedChanges(true);
      toast.success("Finished parsing file!");
      return doc.data;
    },
    [user, activeProfileId, toast]
  );

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfileId,
        activeProfile: { ...profileData, name: profileName },
        setActiveProfileId,
        createProfile,
        deleteProfile,
        renameProfile,
        parseFile,
        saveChanges,
        hasUnsavedChanges,
        updateContactInfo: (ci) =>
          updateField("contactInfo", { ...profileData.contactInfo, ...ci }),
        updateName: (n) => updateField("name", n), // Implemented updateName
        updateJobTitle: (jt) => updateField("jobTitle", jt), // Implemented updateJobTitle
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
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be inside ProfileProvider");
  }
  return ctx;
}
