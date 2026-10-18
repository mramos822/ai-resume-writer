// The company boards the automatic ingestion reads. Each one is the public list of openings a company publishes on its applicant tracking
// system (Greenhouse or Lever): no key, the whole posting, and every job has its own link to apply on the company's page.
// To add a company, add its board name here (it is the last part of its jobs page: boards.greenhouse.io/<name>, jobs.lever.co/<name>).
// A name that does not exist is skipped by the ingestion and reported in its summary (hubspot, doordash, etsy, unity... answered 404: they
// use another system or another name, so they are not here; check a name at boards-api.greenhouse.io/v1/boards/<name>/jobs).
export type AtsSource = "greenhouse" | "lever" | "ashby";
export interface Board {
  source: AtsSource;
  token: string;
  /** how the company is shown, when it is not just the board name capitalized */
  name?: string;
}

const gh = (names: string): Board[] => names.split(/\s+/).filter(Boolean).map((token) => ({ source: "greenhouse" as const, token }));
const lv = (names: string): Board[] => names.split(/\s+/).filter(Boolean).map((token) => ({ source: "lever" as const, token }));
const ab = (names: string): Board[] => names.split(/\s+/).filter(Boolean).map((token) => ({ source: "ashby" as const, token }));

// names that are not the board name with a capital letter
const NAMES: Record<string, string> = { scaleai: "Scale AI", gitlab: "GitLab", mongodb: "MongoDB", hubspot: "HubSpot", doordash: "DoorDash", launchdarkly: "LaunchDarkly", pagerduty: "PagerDuty", newrelic: "New Relic", nerdwallet: "NerdWallet", cockroachlabs: "Cockroach Labs", epicgames: "Epic Games", riotgames: "Riot Games", lucidchart: "Lucid", sofi: "SoFi", gopuff: "goPuff", weride: "WeRide", openai: "OpenAI", clickup: "ClickUp", elevenlabs: "ElevenLabs", supabase: "Supabase", vanta: "Vanta", handshake: "Handshake", cursor: "Cursor", decagon: "Decagon", harvey: "Harvey", ashby: "Ashby", hex: "Hex", cloverhealth: "Clover Health", flatironhealth: "Flatiron Health", ginkgobioworks: "Ginkgo Bioworks", modernhealth: "Modern Health", omadahealth: "Omada Health", lyrahealth: "Lyra Health", includedhealth: "Included Health", renttherunway: "Rent the Runway", stitchfix: "Stitch Fix", purestorage: "Pure Storage", khanacademy: "Khan Academy", masterclass: "MasterClass", dlocal: "dLocal", wikimedia: "Wikimedia Foundation", ro: "Ro", zocdoc: "Zocdoc", sweetgreen: "Sweetgreen", warbyparker: "Warby Parker", oscar: "Oscar Health", natera: "Natera", adyen: "Adyen", waymo: "Waymo", veeva: "Veeva", mercury: "Mercury", wise: "Wise" };

export const BOARDS: Board[] = [
  ...gh(`stripe airbnb figma discord dropbox databricks cloudflare twilio robinhood coinbase reddit pinterest lyft instacart asana gitlab mongodb
    elastic datadog okta anthropic scaleai brex samsara roblox duolingo gusto flexport carta chime affirm block squarespace   toast
    peloton  airtable  mixpanel sofi checkr   gemini   fivetran  pagerduty twitch intercom
     launchdarkly  verkada   cockroachlabs newrelic    epicgames riotgames`),
  ...lv(`spotify palantir wealthfront coupa gopuff weride zoox anchorage aledade outreach`),
  // health, finance, retail, education, logistics, media and Latin America (added after probing which names exist)
  ...gh(`
    flatironhealth oscar zocdoc doximity ginkgobioworks natera modernhealth omadahealth talkspace
    cloverhealth mercury wise blend upstart justworks betterment adyen glossier
    renttherunway stitchfix faire sweetgreen roku vercel netlify fastly tanium
    rubrik purestorage zscaler coursera udemy khanacademy masterclass project44 fleetio
    mozilla wikimedia waymo nuro
  `),
  ...lv(`ro veeva lyrahealth includedhealth dlocal kavak`),
  // Ashby: the system many newer companies use
  ...ab(`supabase linear cursor vanta notion ramp cohere perplexity openai zapier replit webflow plaid harvey hex clickup ashby decagon handshake sierra runway pika writer modal lambda elevenlabs cerebras`),
].map((b) => ({ ...b, name: b.name ?? NAMES[b.token] }));

