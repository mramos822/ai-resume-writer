/* Finds English text that is still not going through tr()/t() in the client code, so it can be wrapped or translated.
 * Usage: node scripts/i18n-leftovers.cjs [file...]   (no files: every client file under src/) */
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "src");
const SKIP_ATTR = new Set(["className", "href", "src", "id", "key", "type", "name", "role", "htmlFor", "style", "target", "rel", "autoComplete", "inputMode", "accept", "viewBox", "d", "fill", "stroke", "points", "variant", "size", "side", "align", "mode", "lang", "data-block", "data-state", "tabIndex", "value", "aria-live", "aria-current", "aria-checked", "aria-pressed", "aria-expanded", "aria-selected", "method", "as", "loading", "priority", "sizes", "width", "height", "ref", "cx", "cy", "r", "x", "y", "transform"]);
const SKIP_PROP = new Set(["id", "key", "className", "href", "url", "type", "kind", "icon", "template", "mode", "status", "method", "headers", "Authorization", "Content-Type", "tone", "variant", "color", "bg", "border", "path", "to", "src", "font", "weight", "ease", "delay", "transition", "animate", "initial", "exit", "origin", "source", "storage", "cookie", "regex", "pattern", "role", "name"]);
const CALLS_SKIP = new Set(["tr", "trx", "t", "tx", "log", "warn", "error", "debug", "info", "fetch", "authFetch", "getItem", "setItem", "removeItem", "querySelector", "querySelectorAll", "getElementById", "addEventListener", "removeEventListener", "createElement", "require", "import", "RegExp", "Symbol", "JSON", "parse", "stringify", "includes", "startsWith", "endsWith", "indexOf", "test", "replace", "split", "join", "has", "get", "set", "delete", "push", "useState", "useRef", "dispatchEvent", "CustomEvent", "Event", "URLSearchParams", "append", "classList", "cn", "clsx", "twMerge"]);

const looksEnglish = (s) => {
  if (s.length < 4 || /[{}<>=]/.test(s) && !/\{\w+\}/.test(s)) return false;
  if (/^[a-z0-9_\-:/\.\[\]%@#]+$/i.test(s) && !/\s/.test(s)) return false; // an id, a path, a class
  if (/^(flex|grid|inline|block|absolute|relative|fixed|bg-|text-|border-|rounded|p[xytblr]?-|m[xytblr]?-|w-|h-|min-|max-|gap-|space-|items-|justify-|font-|shadow|ring|transition|animate|hover:|focus|dark:|sm:|md:|lg:|group|sr-only|hidden|overflow|opacity|z-|top-|left-|right-|bottom-|inset|translate|scale|rotate|cursor|select-|pointer|leading|tracking|underline|line-through|whitespace|break|truncate|aspect|object|origin|backdrop|blur|divide|outline|accent|col-|row-|order|mx-|my-|-mt|-mb)/.test(s)) return false;
  const words = s.trim().split(/\s+/);
  if (words.length >= 2 && /[A-Za-z]{3,}/.test(s) && (/^[A-Z“"'¿¡(]/.test(s) || /[.?!:…]$/.test(s) || /\b(the|and|your|you|for|with|to|of|in|is|are|not|this|that|can|will|please|an|a)\b/i.test(s))) {
    // a list of tailwind classes has many hyphenated tokens
    const hyphen = words.filter((w) => /-/.test(w) || /^[a-z]+:/.test(w)).length;
    return hyphen < Math.ceil(words.length / 2);
  }
  return /^[A-Z][a-z]{3,}[a-z’']*[.!?…]?$/.test(s) && words.length === 1 && s.length > 3;
};

function files(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["__tests__", "i18n", "ui"].includes(e.name)) continue;
      files(p, out);
    } else if (/\.tsx?$/.test(e.name) && !/content\.es\./.test(e.name)) out.push(p);
  }
  return out;
}

// texts that already have a Spanish version are not leftovers: the dictionary is keyed by the English text
const have = {};
try {
  const dir = path.join(root, "i18n", "es");
  for (const f of fs.readdirSync(dir)) {
    if (f === "index.ts") continue;
    for (const m of fs.readFileSync(path.join(dir, f), "utf8").matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*:/gm)) have[JSON.parse(m[1])] = true;
  }
} catch {
  /* no dictionary yet */
}
const list = process.argv.slice(2).length ? process.argv.slice(2) : files(root);
let total = 0;
for (const file of list) {
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  if (!/["']use client["']/.test(text.slice(0, 400)) && !process.argv.slice(2).length) continue;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found = [];
  const visit = (n) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && looksEnglish(n.text)) {
      const p = n.parent;
      let skip = false;
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isCaseClause(p)) skip = true;
      else if (ts.isJsxAttribute(p) && SKIP_ATTR.has(p.name.getText(sf))) skip = true;
      else if (ts.isPropertyAssignment(p) && SKIP_PROP.has(p.name.getText(sf).replace(/["']/g, ""))) skip = true;
      else if (ts.isCallExpression(p)) {
        const c = p.expression;
        const name = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : "";
        if (CALLS_SKIP.has(name)) skip = true;
      } else if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(p.operatorToken.kind)) skip = true;
      else if (ts.isElementAccessExpression(p)) skip = true;
      else if (ts.isNewExpression(p) && ts.isIdentifier(p.expression) && ["Error", "RegExp", "URL"].includes(p.expression.text)) skip = true;
      if (!skip && !have[n.text]) found.push({ line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, text: n.text });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (found.length) {
    console.log(`\n${path.relative(root, file).replace(/\\/g, "/")}`);
    for (const f of found) console.log(`  ${f.line}: ${f.text}`);
    total += found.length;
  }
}
console.log(`\n${total} possible leftovers`);
