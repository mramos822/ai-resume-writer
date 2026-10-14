/* Wraps the visible English text of client components in tr("...") so it can be translated.
 * Usage: node scripts/i18n-wrap.cjs <file...>
 * It is a one-time helper: the result is reviewed by hand. Safe to run twice (text already in tr() is skipped). */
const ts = require("typescript");
const fs = require("fs");

const ATTRS = new Set(["placeholder", "alt", "title", "aria-label", "aria-description", "label", "description", "emptyText", "confirmText", "cancelText"]);
const PROPS = new Set(["title", "desc", "label", "blurb", "q", "a", "more", "hint", "text", "description", "sub", "caption", "tip", "heading", "summary", "detail", "message", "placeholder", "intro", "body", "name2", "short"]);
const IDENTS = new Set(["q", "a", "more", "label", "title", "desc", "text", "hint", "t", "sub", "blurb", "caption", "heading", "summary", "detail", "description"]);
const TOAST = new Set(["success", "error", "info", "warning", "message", "loading"]);
const DIALOG_PROPS = new Set(["title", "description", "confirmText", "cancelText", "label", "placeholder"]);
const ENT = { "&apos;": "'", "&quot;": '"', "&ldquo;": "“", "&rdquo;": "”", "&lsquo;": "‘", "&rsquo;": "’", "&amp;": "&", "&rarr;": "→", "&larr;": "←", "&mdash;": "—", "&ndash;": "–", "&hellip;": "…", "&nbsp;": " ", "&gt;": ">", "&lt;": "<" };
const decode = (s) => s.replace(/&[a-z]+;/g, (m) => ENT[m] ?? m);
const hasLetters = (s) => /[A-Za-zÀ-ÿ]{2,}|[A-Za-z]\b/.test(s) && /[A-Za-zÀ-ÿ]/.test(s);
const q = (s) => JSON.stringify(s);

function run(file) {
  const raw = fs.readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  const text = raw.replace(/\r\n/g, "\n");
  if (!/^\s*(?:\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*(["'])use client\1/.test(text)) return { skipped: "not a client file" };
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const warn = [];
  let count = 0;

  const insideTr = (node) => {
    const p = node.parent;
    return p && ts.isCallExpression(p) && ts.isIdentifier(p.expression) && (p.expression.text === "tr" || p.expression.text === "trx");
  };

  /** the outermost function declared at the top level that contains `node` */
  const topFunction = (node) => {
    let cur = node;
    let found = null;
    while (cur && cur.parent && cur.parent !== sf) {
      cur = cur.parent;
    }
    // cur is now a statement of the source file
    if (ts.isFunctionDeclaration(cur)) found = { fn: cur, name: cur.name?.text ?? "default" };
    else if (ts.isVariableStatement(cur)) {
      for (const d of cur.declarationList.declarations) {
        let init = d.initializer;
        while (init && (ts.isParenthesizedExpression(init) || ts.isAsExpression(init))) init = init.expression;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) found = { fn: init, name: d.name.text };
        else if (init && ts.isCallExpression(init)) {
          // React.forwardRef(function X(...) {...}) / memo(...)
          const arg = init.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
          if (arg) found = { fn: arg, name: d.name.text };
        }
      }
    } else if (ts.isExportAssignment(cur)) {
      const e = cur.expression;
      if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) found = { fn: e, name: "default" };
    }
    return found;
  };

  const needHook = new Map(); // function node -> name
  const markUse = (node) => {
    count++;
    const f = topFunction(node);
    if (!f) {
      warn.push(`no top-level function for use at ${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
      return;
    }
    needHook.set(f.fn, f.name);
  };

  const wrapString = (lit, vars) => {
    // lit: StringLiteral | NoSubstitutionTemplateLiteral
    if (insideTr(lit)) return;
    const val = lit.text;
    if (!hasLetters(val)) return;
    edits.push({ start: lit.getStart(), end: lit.getEnd(), text: `tr(${q(val)})` });
    markUse(lit);
  };

  const wrapTemplate = (tpl) => {
    if (insideTr(tpl)) return;
    let key = tpl.head.text;
    const vars = [];
    let n = 0;
    for (const span of tpl.templateSpans) {
      const e = span.expression;
      let name = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : `v${n}`;
      n++;
      if (!/^[A-Za-z_]\w*$/.test(name) || vars.some((v) => v.name === name)) name = `v${n}`;
      vars.push({ name, code: e.getText(sf) });
      key += `{${name}}` + span.literal.text;
    }
    if (!hasLetters(key.replace(/\{\w+\}/g, ""))) return;
    const obj = vars.map((v) => (v.name === v.code ? v.name : `${v.name}: ${v.code}`)).join(", ");
    edits.push({ start: tpl.getStart(), end: tpl.getEnd(), text: `tr(${q(key)}, { ${obj} })` });
    markUse(tpl);
  };

  /** strings that end up on screen inside an expression (a ternary, &&, ||, a plain literal) */
  const wrapExpr = (e) => {
    if (!e) return;
    if (ts.isParenthesizedExpression(e)) return wrapExpr(e.expression);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return wrapString(e);
    if (ts.isTemplateExpression(e)) return wrapTemplate(e);
    if (ts.isConditionalExpression(e)) {
      wrapExpr(e.whenTrue);
      wrapExpr(e.whenFalse);
      return;
    }
    if (ts.isBinaryExpression(e) && (e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || e.operatorToken.kind === ts.SyntaxKind.BarBarToken || e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
      if (e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) wrapExpr(e.right);
      else {
        wrapExpr(e.right);
      }
      return;
    }
  };

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const t = node.text;
      const core = decode(t.split("\n").map((l) => l.trim()).filter(Boolean).join(" "));
      if (core && hasLetters(core)) {
        const lead = /^[ \t]+\S/.test(t) || /^[ \t]+$/.test(t.split("\n")[0] ?? "") && !t.startsWith("\n") && t.split("\n").length === 1 ? " " : "";
        const trail = /\S[ \t]+$/.test(t) ? " " : "";
        const startsWs = /^\s/.test(t);
        const endsWs = /\s$/.test(t);
        const leadSpace = startsWs && !/^\s*\n/.test(t) ? '{" "}' : "";
        const trailSpace = endsWs && !/\n\s*$/.test(t) ? '{" "}' : "";
        void lead; void trail;
        edits.push({ start: node.pos, end: node.getEnd(), text: `${leadSpace}{tr(${q(core)})}${trailSpace}` });
        markUse(node);
      }
    } else if (ts.isJsxAttribute(node) && node.initializer && ATTRS.has(node.name.getText(sf))) {
      const ini = node.initializer;
      if (ts.isStringLiteral(ini) && hasLetters(ini.text)) {
        edits.push({ start: ini.getStart(), end: ini.getEnd(), text: `{tr(${q(ini.text)})}` });
        markUse(ini);
      } else if (ts.isJsxExpression(ini) && ini.expression) wrapExpr(ini.expression);
    } else if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      const e = node.expression;
      if (ts.isIdentifier(e) && IDENTS.has(e.text)) {
        if (!insideTr(e)) {
          edits.push({ start: e.getStart(), end: e.getEnd(), text: `tr(${e.text})` });
          markUse(e);
        }
      } else if (ts.isPropertyAccessExpression(e) && PROPS.has(e.name.text)) {
        if (!insideTr(e)) {
          edits.push({ start: e.getStart(), end: e.getEnd(), text: `tr(${e.getText(sf)})` });
          markUse(e);
        }
      } else wrapExpr(e);
    } else if (ts.isCallExpression(node)) {
      const c = node.expression;
      if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === "toast" && TOAST.has(c.name.text) && node.arguments[0]) wrapExpr(node.arguments[0]);
      else if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === "dialog" && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
        for (const p of node.arguments[0].properties) if (ts.isPropertyAssignment(p) && DIALOG_PROPS.has(p.name.getText(sf))) wrapExpr(p.initializer);
      } else if (ts.isIdentifier(c) && /^set(Error|Msg|Message)$/.test(c.text) && node.arguments[0]) wrapExpr(node.arguments[0]);
    } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Error" && node.arguments?.[0]) wrapExpr(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!edits.length) return { changed: 0, warn };

  // de-duplicate overlapping edits (a string inside a call that was wrapped already)
  edits.sort((a, b) => b.start - a.start);
  let out = text;
  let lastStart = Infinity;
  for (const e of edits) {
    if (e.end > lastStart) continue;
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    lastStart = e.start;
  }

  // the hook in every component that needs it
  const hookEdits = [];
  for (const [fn, name] of needHook) {
    const body = fn.body;
    if (!body || !ts.isBlock(body)) {
      warn.push(`${name}: expression-bodied function, add the hook by hand`);
      continue;
    }
    const already = /useT\(\)/.test(body.getText(sf));
    if (already) continue;
    if (!/^[A-Z]/.test(name) && name !== "default") warn.push(`${name}: not a component (lowercase), tr may be out of scope`);
    hookEdits.push(body.getStart() + 1);
  }
  // positions refer to the original text: apply from the end, on top of the already edited text by recomputing offsets
  // (hooks go right after "{" of a body, which no text edit overlaps: shift by the net length change of edits before it)
  const delta = (pos) => edits.filter((e) => e.end <= pos).reduce((n, e) => n + (e.text.length - (e.end - e.start)), 0);
  hookEdits.sort((a, b) => b - a);
  for (const pos of hookEdits) {
    const at = pos + delta(pos);
    out = out.slice(0, at) + "\n  const { tr } = useT();" + out.slice(at);
  }
  if (!/from "@\/i18n\/provider"/.test(out) || !/\buseT\b/.test(out.split("\n").filter((l) => l.includes("@/i18n/provider")).join("\n"))) {
    const imports = [...out.matchAll(/^import[\s\S]*?;\n/gm)];
    const last = imports[imports.length - 1];
    const at = last.index + last[0].length;
    out = out.slice(0, at) + 'import { useT } from "@/i18n/provider";\n' + out.slice(at);
  }
  fs.writeFileSync(file, crlf ? out.replace(/\n/g, "\r\n") : out, "utf8");
  return { changed: count, hooks: hookEdits.length, warn };
}

for (const f of process.argv.slice(2)) {
  try {
    const r = run(f);
    console.log(f, JSON.stringify(r));
  } catch (e) {
    console.log(f, "ERROR", e.message);
  }
}
