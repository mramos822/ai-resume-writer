// The text of a posting is what fills the jobs index (about 95% of each document), and the free plan of Atlas counts the SIZE OF THE DATA (not what
// is left on disk after its own compression) against its 512 MB. So the description is kept compressed (brotli, as text), in the field `descZ`, and
// put back when the document is read. A document that still has its plain `description` (written before) reads the same: both forms work.
import { brotliCompressSync, brotliDecompressSync, constants } from "zlib";
import { Binary } from "mongodb";

/** below this length compressing saves nothing */
const MIN_CHARS = 600;

/** The document with its `description` compressed in `descZ` (and no `description`); the same document when the text is short or absent. */
export function packDescription<T extends Record<string, unknown>>(doc: T): T {
  const { description, ...rest } = doc as Record<string, unknown>;
  if (typeof description !== "string" || description.length < MIN_CHARS) return doc;
  const z = brotliCompressSync(Buffer.from(description, "utf8"), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 9, [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT },
  });
  return { ...rest, descZ: new Binary(z) } as unknown as T;
}

/** The document with its `description` back (and no `descZ`). A document without `descZ` is returned as it is. */
export function unpackDescription<T>(doc: T): T {
  const d = doc as unknown as Record<string, unknown> | null;
  if (!d || !("descZ" in d)) return doc;
  const { descZ, ...rest } = d;
  try {
    const bytes = descZ instanceof Binary ? descZ.buffer : Buffer.from(descZ as Uint8Array);
    return { ...rest, description: brotliDecompressSync(bytes).toString("utf8") } as unknown as T;
  } catch {
    return rest as unknown as T; // a damaged text is left out: the job is shown with what the board gave in `snippet`
  }
}
