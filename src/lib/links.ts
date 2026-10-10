export interface LinkEntry {
  label: string;
  url: string;
}

export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string;
  year: string;
}

export const LINK_LABELS = ["LinkedIn", "GitHub", "Portfolio", "Website", "Twitter / X", "Behance", "Dribbble", "GitLab", "Medium", "YouTube", "Instagram"];

/** "https://www.linkedin.com/in/sam/" -> "linkedin.com/in/sam" (shorter, readable on a resume). */
export function displayUrl(url: string): string {
  return (url || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}
