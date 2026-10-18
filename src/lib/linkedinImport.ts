import { detectSelfEmployed } from "@/lib/selfEmployed";
import { randomUUID } from "crypto";
import type { EducationEntry, JobEntry, ProfileData, ProjectEntry } from "@/context/profileContext";

// Import from the data LinkedIn gives a person: in LinkedIn, Settings > Data privacy > "Get a copy of your data" produces a ZIP
// of CSV files (Profile, Positions, Education, Skills, Languages, Certifications, Projects). Nothing is read from LinkedIn
// itself: the person downloads their own file and gives it to Kaizo, so no password, token or scraping is involved.

/** A CSV reader that understands quotes and line breaks inside quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Jan 2020" -> "2020-01"; "2020" -> "2020-01"; anything else -> "". */
export function toMonth(v?: string): string {
  const s = (v || "").trim();
  const m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(s);
  if (m) {
    const i = MONTHS.indexOf(m[1].toLowerCase());
    if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, "0")}`;
  }
  const y = /^(\d{4})$/.exec(s);
  return y ? `${y[1]}-01` : "";
}

/** Splits a free-text description into bullets (lines that start with a bullet or a dash) and the rest. */
function bulletsOf(text: string): { description: string; bullets: string[] } {
  const lines = (text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => /^[•\-*–▪●]\s*/.test(l)).map((l) => l.replace(/^[•\-*–▪●]\s*/, "").slice(0, 220));
  const rest = lines.filter((l) => !/^[•\-*–▪●]\s*/.test(l)).join(" ");
  return bullets.length >= 1 ? { description: "", bullets: bullets.slice(0, 8) } : { description: rest.slice(0, 600), bullets: [] };
}

const get = (files: Record<string, string>, name: string) => parseCsv(files[name.toLowerCase()] ?? "");

/** What the person's LinkedIn files say, in the shape of a Kaizo profile (only the parts that exist). */
export function readLinkedIn(files: Record<string, string>): Partial<ProfileData> & { _counts?: Record<string, number> } {
  const out: Partial<ProfileData> = {};

  const profile = get(files, "Profile.csv")[0];
  if (profile) {
    const name = [profile["First Name"], profile["Last Name"]].filter(Boolean).join(" ").trim();
    if (name) out.name = name;
    if (profile["Headline"]) out.jobTitle = profile["Headline"].slice(0, 100);
    if (profile["Summary"]) out.careerObjective = profile["Summary"].slice(0, 900);
    const geo = (profile["Geo Location"] || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (geo.length) out.contactInfo = { email: "", phone: "", address: "", city: geo[0], state: geo.length >= 3 ? geo[1] : "", country: geo[geo.length - 1] };
  }

  const toJob = (r: Record<string, string>): JobEntry | null => {
    const title = r["Title"] || "";
    const company = r["Company Name"] || "";
    if (!title && !company) return null;
    const { description, bullets } = bulletsOf(r["Description"]);
    const end = toMonth(r["Finished On"]);
    const job: JobEntry = { id: `job-${randomUUID()}`, company: company.slice(0, 120), title: title.slice(0, 120), location: (r["Location"] || "").slice(0, 100), description, startDate: toMonth(r["Started On"]), endDate: end, current: !r["Finished On"], accomplishments: bullets };
    return detectSelfEmployed(job) ? { ...job, selfEmployed: true } : job;
  };
  const jobs = get(files, "Positions.csv").map(toJob).filter((j): j is JobEntry => !!j);
  if (jobs.length) out.jobHistory = jobs;

  const edu = get(files, "Education.csv")
    .map((r): EducationEntry | null => {
      if (!r["School Name"]) return null;
      const end = toMonth(r["End Date"]);
      return { id: `edu-${randomUUID()}`, school: r["School Name"].slice(0, 140), degree: [r["Degree Name"], ""].filter(Boolean).join("").slice(0, 140), startDate: toMonth(r["Start Date"]), endDate: end, current: !r["End Date"] && !!r["Start Date"], honors: (r["Notes"] || "").slice(0, 160) };
    })
    .filter((e): e is EducationEntry => !!e);
  if (edu.length) out.education = edu;

  const skills = get(files, "Skills.csv").map((r) => r["Name"]).filter(Boolean);
  if (skills.length) out.skills = Array.from(new Set(skills)).slice(0, 60);

  const langs = get(files, "Languages.csv").filter((r) => r["Name"]).map((r) => ({ name: r["Name"], level: r["Proficiency"] ? r["Proficiency"].replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "" }));
  if (langs.length) out.languages = langs.slice(0, 12);

  const certs = get(files, "Certifications.csv").filter((r) => r["Name"]).map((r) => ({ id: `cert-${randomUUID()}`, name: r["Name"].slice(0, 140), issuer: (r["Authority"] || "").slice(0, 100), year: (/\d{4}/.exec(r["Started On"] || "") ?? [""])[0] }));
  if (certs.length) out.certifications = certs.slice(0, 20);

  const projects = get(files, "Projects.csv")
    .filter((r) => r["Title"])
    .map((r): ProjectEntry => {
      const { description, bullets } = bulletsOf(r["Description"]);
      return { id: `proj-${randomUUID()}`, name: r["Title"].slice(0, 120), description, link: r["Url"] || undefined, technologies: [], accomplishments: bullets, startDate: toMonth(r["Started On"]), endDate: toMonth(r["Finished On"]) } as ProjectEntry;
    });
  if (projects.length) out.projects = projects.slice(0, 20);

  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Adds what LinkedIn has to what the profile already has. Nothing the person wrote is replaced or removed. */
export function mergeLinkedIn(base: ProfileData, inc: Partial<ProfileData>): { data: ProfileData; added: Record<string, number> } {
  const added: Record<string, number> = {};
  const data: ProfileData = { ...base, contactInfo: { ...base.contactInfo } };
  const blank = (v?: string) => !v || !v.trim() || /^John Doe$/i.test(v.trim());

  if (blank(data.name) && inc.name) data.name = inc.name;
  if (blank(data.jobTitle) && inc.jobTitle) data.jobTitle = inc.jobTitle;
  if (blank(data.careerObjective) && inc.careerObjective) {
    data.careerObjective = inc.careerObjective;
    added.summary = 1;
  }
  if (inc.contactInfo) {
    const c = data.contactInfo;
    if (!c.city && inc.contactInfo.city) c.city = inc.contactInfo.city;
    if (!c.state && inc.contactInfo.state) c.state = inc.contactInfo.state;
    if (!c.country && inc.contactInfo.country) c.country = inc.contactInfo.country;
  }

  const skills = [...(base.skills ?? [])];
  const have = new Set(skills.map(norm));
  for (const s of inc.skills ?? []) {
    if (have.has(norm(s))) continue;
    skills.push(s);
    have.add(norm(s));
    added.skills = (added.skills || 0) + 1;
  }
  data.skills = skills;

  const jobs = [...(base.jobHistory ?? [])];
  const jobKeys = new Set(jobs.map((j) => norm(`${j.company}|${j.title}`)));
  for (const j of inc.jobHistory ?? []) {
    if (jobKeys.has(norm(`${j.company}|${j.title}`))) continue;
    jobs.push(j);
    added.jobs = (added.jobs || 0) + 1;
  }
  data.jobHistory = jobs;

  const edus = [...(base.education ?? [])];
  const eduKeys = new Set(edus.map((e) => norm(`${e.school}|${e.degree}`)));
  for (const e of inc.education ?? []) {
    if (eduKeys.has(norm(`${e.school}|${e.degree}`))) continue;
    edus.push(e);
    added.education = (added.education || 0) + 1;
  }
  data.education = edus;

  const langs = [...(base.languages ?? [])];
  const langKeys = new Set(langs.map((l) => norm(l.name)));
  for (const l of inc.languages ?? []) {
    if (langKeys.has(norm(l.name))) continue;
    langs.push(l);
    added.languages = (added.languages || 0) + 1;
  }
  if (langs.length) data.languages = langs;

  const certs = [...(base.certifications ?? [])];
  const certKeys = new Set(certs.map((c) => norm(c.name)));
  for (const c of inc.certifications ?? []) {
    if (certKeys.has(norm(c.name))) continue;
    certs.push(c);
    added.certifications = (added.certifications || 0) + 1;
  }
  if (certs.length) data.certifications = certs;

  const projs = [...(base.projects ?? [])];
  const projKeys = new Set(projs.map((p) => norm(p.name)));
  for (const p of inc.projects ?? []) {
    if (projKeys.has(norm(p.name))) continue;
    projs.push(p);
    added.projects = (added.projects || 0) + 1;
  }
  data.projects = projs;

  return { data, added };
}
