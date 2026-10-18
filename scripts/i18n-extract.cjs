/* Lists every text that must be translated: tr("...") calls and the texts kept in data (title:, label:, ...).
 * Usage: node scripts/i18n-extract.cjs [--missing]   (with --missing: only the ones that have no Spanish yet) */
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const PROPS = new Set(["title", "desc", "label", "blurb", "q", "a", "more", "hint", "text", "description", "sub", "caption", "tip", "heading", "summary", "detail", "message", "placeholder", "intro", "body", "short"]);
const root = path.join(__dirname, "..", "src");
const keys = new Map();
const add = (k, f) => {
  if (!k || !/[A-Za-z]{2,}/.test(k)) return;
  if (!keys.has(k)) keys.set(k, new Set());
  keys.get(k).add(path.relative(root, f).replace(/\\/g, "/"));
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "__tests__" || e.name === "i18n" || e.name === "ui") continue;
      walk(p, out);
    } else if (/\.(tsx|ts)$/.test(e.name) && !/content\.es\./.test(e.name)) out.push(p);
  }
  return out;
}

for (const file of walk(root)) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ["tr", "trx", "t", "tx"].includes(n.expression.text) && n.arguments[0]) {
      const a = n.arguments[0];
      if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) add(a.text, file);
    } else if (ts.isPropertyAssignment(n) && PROPS.has(n.name.getText(sf)) && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) {
      const v = n.initializer.text;
      if (/\s/.test(v) || /^[A-Z]/.test(v)) add(v, file);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

let es = {};
try {
  // the dictionary is TypeScript: read the keys with a regex over the files in src/i18n/es
  const dir = path.join(root, "i18n", "es");
  for (const f of fs.readdirSync(dir)) {
    if (f === "index.ts") continue;
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of src.matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*:/gm)) es[JSON.parse(m[1])] = true;
  }
} catch {
  es = {};
}

const missingOnly = process.argv.includes("--missing");
const list = [...keys.keys()].filter((k) => !missingOnly || !es[k]).sort();
fs.writeFileSync(path.join(__dirname, "..", "i18n-keys.json"), JSON.stringify(list, null, 1));
console.log(`${list.length} texts${missingOnly ? " without Spanish" : ""} (of ${keys.size})`);
