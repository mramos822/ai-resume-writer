import { createHash } from "crypto";

/** A short fingerprint of a prompt: when the prompt is edited it changes, and the answers kept for the old one stop being used. */
export const promptVersion = (prompt: string): string => createHash("sha1").update(prompt).digest("hex").slice(0, 8);
