/* Puts `import { useT } from "@/i18n/provider"` right after the last real import of each file (a one-time helper). */
const ts = require("typescript");
const fs = require("fs");
const LINE = 'import { useT } from "@/i18n/provider";';
for (const file of process.argv.slice(2)) {
  const raw = fs.readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  let text = raw.replace(/\r\n/g, "\n");
  if (!text.includes(LINE)) continue;
  text = text.split("\n").filter((l, i, a) => l !== LINE).join("\n");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let end = 0;
  sf.statements.forEach((st) => {
    if (ts.isImportDeclaration(st)) end = st.getEnd();
  });
  // keep a trailing comment on the same line as the last import
  const rest = text.slice(end);
  const nl = rest.indexOf("\n");
  const cut = nl === -1 ? text.length : end + nl;
  const out = text.slice(0, cut) + "\n" + LINE + text.slice(cut);
  fs.writeFileSync(file, crlf ? out.replace(/\n/g, "\r\n") : out, "utf8");
}
