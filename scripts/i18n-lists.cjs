/* Writes the lists of words the app shows as suggestions (job titles, skills, degrees, languages, verbs...) to i18n-lists.json,
 * and says which of them still have no Spanish in src/i18n/es. Usage: node scripts/i18n-lists.cjs */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const Module = require("module");

const root = path.join(__dirname, "..");
const load = (rel) => {
  const file = path.join(root, rel);
  const out = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const m = new Module(file);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(out, file);
  return m.exports;
};

const lists = {};
const add = (name, values) => (lists[name] = Array.from(new Set(values)));
const titles = load("src/lib/jobTitles.ts");
add("jobTitles", titles.JOB_TITLES);
const skills = load("src/lib/skills.ts");
add("skills", [...skills.ALL_SKILLS, ...skills.POPULAR_SKILLS]);
const schools = load("src/lib/schools.ts");
add("degrees", schools.DEGREES);
const langs = load("src/lib/languages.ts");
add("languages", [...langs.LANGUAGES, ...langs.POPULAR_LANGUAGES, ...langs.LANGUAGE_LEVELS]);
const bullets = load("src/lib/bullets.ts");
add("verbs", bullets.ACTION_VERBS);
const links = load("src/lib/links.ts");
add("linkLabels", links.LINK_LABELS);
const levels = load("src/lib/skillLevels.ts");
add("skillLevels", [...levels.SKILL_LEVEL_LABELS]);

// what the dictionary already has
const es = fs.readdirSync(path.join(root, "src/i18n/es")).filter((f) => /^part\d|^lists/.test(f)).map((f) => fs.readFileSync(path.join(root, "src/i18n/es", f), "utf8")).join("\n");
const have = new Set([...es.matchAll(/^\s*("(?:[^"\\]|\\.)*"):/gm)].map((m) => JSON.parse(m[1])));
const missing = {};
for (const [k, v] of Object.entries(lists)) missing[k] = v.filter((x) => !have.has(x));
fs.writeFileSync(path.join(root, "i18n-lists.json"), JSON.stringify(missing, null, 1));
for (const k of Object.keys(lists)) console.log(`${k}: ${lists[k].length} (${missing[k].length} without Spanish)`);
