// How a screen asks the job search. ONE place builds the question, so the dashboard (which asks in the background when the person arrives) and
// the job search page ask EXACTLY the same thing: the answer the first one got is remembered by the server, and the second one gets it at once.

export interface JobSearchAsk {
  q: string;
  place: string;
  country: string;
  /** a search for remote work (the place is then "Remote") */
  remote?: boolean;
  /** the skills of the profile: the main ones widen the search */
  skills?: string[];
  /** the language of the app */
  lang: string;
  /** all languages, whatever the app's language (a filter the person chose) */
  allLanguages?: boolean;
}

/** The parameters of /api/jobs/search (without the phase: "own", then "adzuna"). */
export function jobSearchParams(a: JobSearchAsk): URLSearchParams {
  const params = new URLSearchParams({ q: a.q.trim(), location: a.remote ? "" : a.place.trim(), country: a.country });
  if (a.remote) params.set("remote", "1");
  // a wider search: similar titles and the main skills of the profile, so there are more jobs that fit
  params.set("wide", "1");
  params.set("lang", a.allLanguages ? "all" : a.lang);
  if (a.skills?.length) params.set("skills", a.skills.slice(0, 3).join(","));
  return params;
}

/** The same parameters for one of the parts of the search. */
export const withPhase = (params: URLSearchParams, phase: "own" | "live" | "adzuna") => new URLSearchParams({ ...Object.fromEntries(params), phase });
