/** Whole years between the first job that has a start date and the end of the last one (or today, for a job still going). */
export function experienceYears(jobs: { startDate?: string; endDate?: string; current?: boolean }[], now = new Date()): number {
  const month = (v?: string) => {
    const m = /^(\d{4})-(\d{2})/.exec(v ?? "");
    return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
  };
  const starts = jobs.map((j) => month(j.startDate)).filter((n): n is number => n !== null);
  if (starts.length === 0) return 0;
  const today = now.getFullYear() * 12 + now.getMonth();
  const ends = jobs.map((j) => (j.current || !j.endDate ? today : month(j.endDate) ?? today));
  return Math.max(0, Math.floor((Math.max(...ends) - Math.min(...starts)) / 12));
}

/** The figures a health resume shows under the header: only the ones that are above zero. */
export function keyFigures(p: { years: number; certifications: number; languages: number; skills: number }): { value: string; label: string }[] {
  return [
    { value: p.years > 0 ? `${p.years}+` : "", label: "Years of experience" },
    { value: p.certifications > 0 ? String(p.certifications) : "", label: "Certifications" },
    { value: p.languages > 0 ? String(p.languages) : "", label: "Languages" },
    { value: p.skills > 0 ? String(p.skills) : "", label: "Skills" },
  ]
    .filter((f) => f.value)
    .slice(0, 3);
}
