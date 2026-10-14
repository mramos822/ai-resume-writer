// The field of a job or a role (technology, creative, business...), read from its title. Used to suggest looks and to know which skills
// belong to the career of the person and which are far from it.
export type LookField = "tech" | "creative" | "business" | "health" | "academic" | "general";

export const FIELD_PATTERNS: { field: Exclude<LookField, "general">; re: RegExp }[] = [
  { field: "tech", re: /\b(developer|engineer|software|devops|cloud|programmer|data|machine learning|backend|frontend|full[- ]?stack|it support|cyber|qa|sre|swe)\b/i },
  { field: "creative", re: /\b(design|designer|ux|ui|creative|brand|content|copywriter|writer|marketing|social media|photo|video|art|animator|illustrat)/i },
  { field: "business", re: /\b(account|finance|audit|tax|bank|legal|lawyer|attorney|paralegal|consult|manager|director|executive|operations|sales|hr|recruit|administrat|project)/i },
  { field: "health", re: /\b(nurse|nursing|health|medical|clinic|clinical|pharm|care|therap|dental|patient)/i },
  { field: "academic", re: /\b(research|professor|lecturer|academic|scientist|phd|teacher|instructor|tutor|postdoc)/i },
];

/** The field a text says, or "" when it says none. */
export function fieldFromText(text: string): LookField | "" {
  return FIELD_PATTERNS.find((f) => f.re.test(text))?.field ?? "";
}
