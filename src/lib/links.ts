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

/** For a contact line with a LinkedIn icon: only "in/name" (the icon says where it is). Any other link keeps its readable address. */
export function shortContactLink(url: string): string {
  const m = /linkedin\.com\/(in\/[^/?#\s]+)/i.exec(url || "");
  return m ? m[1] : displayUrl(url);
}

/** A link shown next to its name ("LinkedIn  in/name"): when the name already says LinkedIn, the address is only "in/name". */
export function labeledLink(label: string, url: string): string {
  return /linkedin/i.test(label || "") ? shortContactLink(url) : displayUrl(url);
}
