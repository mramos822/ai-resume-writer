import { SKILL_GROUPS } from "@/lib/skills";
import { cleanSkillGroups, type SkillGroups } from "@/lib/skillGroups";

/**
 * Suggests a group for each skill, for the "Group automatically" button. Technology skills are split finer than the lists of the
 * autocomplete (languages, frameworks, databases...), the rest use the field they belong to ("Marketing & communications"...).
 * Names are in English; the screen translates them.
 */
const TECH: Record<string, string[]> = {
  "Programming languages": [
    "JavaScript", "TypeScript", "Python", "Java", "C", "C++", "C#", "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Dart", "Scala", "R",
    "Objective-C", "Assembly", "Lua", "Perl", "Haskell", "Julia", "Elixir", "VBA", "COBOL", "Fortran", "Verilog", "VHDL", "MATLAB", "Bash",
    "PowerShell", "HTML", "CSS", "Sass", "SQL",
  ],
  "Frameworks and libraries": [
    "React", "Next.js", "Vue.js", "Angular", "Svelte", "Redux", "Tailwind CSS", "Bootstrap", "jQuery", "Node.js", "Express.js", "Django",
    "Flask", "FastAPI", "Spring Boot", "Ruby on Rails", "Laravel", ".NET", "ASP.NET", "React Native", "Flutter", "Three.js", "TensorFlow",
    "PyTorch", "scikit-learn", "Pandas", "NumPy", "Jest", "Cypress", "Selenium", "Playwright", "Unity", "Unreal Engine",
  ],
  "Databases": ["SQL Server", "PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis", "Elasticsearch", "Oracle", "Snowflake", "BigQuery", "DynamoDB", "Cassandra", "MariaDB"],
  "Cloud and backend": ["Firebase", "Supabase", "AWS", "Azure", "Google Cloud", "Google Cloud Platform", "Heroku", "Vercel", "Netlify", "Docker", "Kubernetes", "Terraform", "Ansible", "Linux", "Unix", "Nginx"],
  "Tools": [
    "Git", "GitHub", "GitLab", "Bitbucket", "VS Code", "VSCode", "Eclipse", "IntelliJ", "Jira", "Confluence", "Postman", "Jenkins", "GitHub Actions",
    "SQL Developer", "Figma", "Jupyter", "Tableau", "Power BI", "Slack", "Trello", "Asana", "Notion", "Excel", "Microsoft Excel",
  ],
};

const index = new Map<string, string>();
for (const [group, list] of Object.entries(TECH)) for (const s of list) index.set(s.toLowerCase(), group);
for (const [group, list] of Object.entries(SKILL_GROUPS)) for (const s of list) if (!index.has(s.toLowerCase())) index.set(s.toLowerCase(), group);

/** The suggested group of one skill, or "" when it is not a known one. */
export function suggestedGroup(skill: string): string {
  return index.get(skill.trim().toLowerCase()) ?? "";
}

/** The English names of every group that can be suggested (so the screen can translate them). */
export const SUGGESTED_GROUP_NAMES: string[] = Array.from(new Set([...Object.keys(TECH), ...Object.keys(SKILL_GROUPS)]));

/**
 * Groups the skills that are in none yet. A group is only made when at least two skills share it, and what the person
 * already grouped is never changed. `name` writes a group name in the language of the screen.
 */
export function autoGroupSkills(skills: string[], current: SkillGroups | undefined, name: (group: string) => string = (g) => g): SkillGroups {
  const next: SkillGroups = { ...(current ?? {}) };
  const loose = skills.filter((s) => !(current?.[s] ?? "").trim());
  const byGroup = new Map<string, string[]>();
  for (const s of loose) {
    const g = suggestedGroup(s);
    if (g) byGroup.set(g, [...(byGroup.get(g) ?? []), s]);
  }
  for (const [g, list] of byGroup) if (list.length >= 2) for (const s of list) next[s] = name(g);
  return cleanSkillGroups(skills, next);
}

/**
 * The groups written in a resume ("Languages: Java, C" ...) as the parser reads them: the skills are added to the list when missing
 * and each one remembers its group.
 */
/** A phrase from the body of a resume that got into the skills (a sentence, or a project heading): a skill is a short name. */
export function looksLikeSentence(skill: string): boolean {
  const s = skill.trim();
  return s.length > 50 || /[•·|]/.test(s) || /[.;]$/.test(s) || s.split(/\s+/).length > 8;
}

export function groupsFromCategories(
  skills: string[],
  categories: unknown
): { skills: string[]; skillGroups: SkillGroups } {
  const out = skills.filter((s) => !looksLikeSentence(s));
  const groups: SkillGroups = {};
  if (!Array.isArray(categories)) return { skills: out, skillGroups: groups };
  const seen = new Set(out.map((s) => s.toLowerCase()));
  for (const cat of categories) {
    const label = typeof cat?.name === "string" ? cat.name.trim().slice(0, 40) : "";
    const list: unknown[] = Array.isArray(cat?.skills) ? cat.skills : [];
    if (!label) continue;
    for (const raw of list) {
      const skill = typeof raw === "string" ? raw.trim().slice(0, 60) : "";
      if (!skill) continue;
      const known = out.find((s) => s.toLowerCase() === skill.toLowerCase());
      if (!known) {
        out.push(skill);
        seen.add(skill.toLowerCase());
      }
      groups[known ?? skill] = label;
    }
  }
  return { skills: out, skillGroups: groups };
}
