import { runMigrations } from "@/lib/migrations";

/** Makes sure the database is up to date (indexes and the rest): see lib/migrations. */
export function ensureIndexes(): Promise<void> {
  return runMigrations();
}
