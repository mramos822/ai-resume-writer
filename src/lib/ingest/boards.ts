// The company boards the automatic ingestion reads. Each one is the public list of openings a company publishes on its applicant tracking
// system (Greenhouse or Lever): no key, the whole posting, and every job has its own link to apply on the company's page.
// To add a company, add its board name here (it is the last part of its jobs page: boards.greenhouse.io/<name>, jobs.lever.co/<name>).
// A name that does not exist is skipped by the ingestion and reported in its summary (hubspot, doordash, etsy, unity... answered 404: they
// use another system or another name, so they are not here; check a name at boards-api.greenhouse.io/v1/boards/<name>/jobs).
export type AtsSource = "greenhouse" | "lever";
export interface Board {
  source: AtsSource;
  token: string;
  /** how the company is shown, when it is not just the board name capitalized */
  name?: string;
}

const gh = (names: string): Board[] => names.split(/\s+/).filter(Boolean).map((token) => ({ source: "greenhouse" as const, token }));
const lv = (names: string): Board[] => names.split(/\s+/).filter(Boolean).map((token) => ({ source: "lever" as const, token }));

// names that are not the board name with a capital letter
const NAMES: Record<string, string> = { scaleai: "Scale AI", gitlab: "GitLab", mongodb: "MongoDB", hubspot: "HubSpot", doordash: "DoorDash", launchdarkly: "LaunchDarkly", pagerduty: "PagerDuty", newrelic: "New Relic", nerdwallet: "NerdWallet", cockroachlabs: "Cockroach Labs", epicgames: "Epic Games", riotgames: "Riot Games", lucidchart: "Lucid", sofi: "SoFi", gopuff: "goPuff", weride: "WeRide" };

export const BOARDS: Board[] = [
  ...gh(`stripe airbnb figma discord dropbox databricks cloudflare twilio robinhood coinbase reddit pinterest lyft instacart asana gitlab mongodb
    elastic datadog okta anthropic scaleai brex samsara roblox duolingo gusto flexport carta chime affirm block squarespace   toast
    peloton  airtable  mixpanel sofi checkr   gemini   fivetran  pagerduty twitch intercom
     launchdarkly  verkada   cockroachlabs newrelic    epicgames riotgames`),
  ...lv(`spotify palantir wealthfront coupa gopuff weride zoox anchorage aledade outreach`),
].map((b) => ({ ...b, name: b.name ?? NAMES[b.token] }));

