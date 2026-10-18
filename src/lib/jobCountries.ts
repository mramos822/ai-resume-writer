/** The countries where the job board (Adzuna) has local jobs. For any other country the live board is not asked. */
export const ADZUNA_COUNTRIES = ["at", "au", "be", "br", "ca", "ch", "de", "es", "fr", "gb", "in", "it", "mx", "nl", "nz", "pl", "sg", "us", "za"];

/**
 * The countries where OUR OWN index has local jobs, beyond Adzuna's: the company boards (Greenhouse, Lever, Ashby, Workable, Recruitee,
 * Teamtailor...) have jobs in every country where those companies hire, and Computrabajo covers Latin America. Counted in the index when this was
 * written (a country with at least about twenty open jobs), plus the Spanish-speaking countries of the Americas, so the people there can choose theirs.
 * When a country gets its own source, add it here; the search of any country in this list reads the index with that country's jobs and the remote ones.
 */
export const OWN_COUNTRIES = [
  // Latin America (Computrabajo and the company boards)
  "pe", "cl", "co", "ar", "ec", "uy", "cr", "do", "pa", "gt", "bo", "py", "sv", "hn", "ni",
  // the rest of the world, by how many jobs the index holds
  "ie", "jp", "cn", "kr", "se", "pt", "gr", "hu", "rs", "ae", "cz", "il", "ro", "dk", "my", "tw", "sa", "ee", "bg", "eg", "ph", "id", "sk", "vn", "pk", "ge", "tr", "th", "hk", "no", "fi",
];

/** Every country the search can be done in: Adzuna's and the ones of our own index. */
export const SEARCH_COUNTRIES = Array.from(new Set([...ADZUNA_COUNTRIES, ...OWN_COUNTRIES]));
