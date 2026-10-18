// The company boards the automatic ingestion reads. Each one is the public list of openings a company publishes on its applicant tracking
// system (Greenhouse or Lever): no key, the whole posting, and every job has its own link to apply on the company's page.
// To add a company, add its board name here (it is the last part of its jobs page: boards.greenhouse.io/<name>, jobs.lever.co/<name>).
// A name that does not exist is skipped by the ingestion and reported in its summary (hubspot, doordash, etsy, unity... answered 404: they
// use another system or another name, so they are not here; check a name at boards-api.greenhouse.io/v1/boards/<name>/jobs).
import { CT_GROUPS, CT_INGEST } from "@/lib/ingest/computrabajo";

export type AtsSource = "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workable" | "recruitee" | "teamtailor" | "computrabajo" | "remotive" | "arbeitnow";
export interface Board {
  source: AtsSource;
  token: string;
  /** how the company is shown, when it is not just the board name capitalized */
  name?: string;
}

const gh = (names: string): Board[] => names.split(/\s+/).filter(Boolean).map((token) => ({ source: "greenhouse" as const, token }));
const lv = (names: string): Board[] => names.split(/\s+/).filter(Boolean).map((token) => ({ source: "lever" as const, token }));
const sr = (names: string): Board[] => names.split(/\s+/).filter(Boolean).map((token) => ({ source: "smartrecruiters" as const, token }));
const wk = (names: string): Board[] => names.split(/\s+/).filter(Boolean).map((token) => ({ source: "workable" as const, token }));
const rc = (names: string): Board[] => names.split(/\s+/).filter(Boolean).map((token) => ({ source: "recruitee" as const, token }));
const tt = (names: string): Board[] => names.split(/\s+/).filter(Boolean).map((token) => ({ source: "teamtailor" as const, token }));
const ab = (names: string): Board[] => names.split(/\s+/).filter(Boolean).map((token) => ({ source: "ashby" as const, token }));

// names that are not the board name with a capital letter
const NAMES: Record<string, string> = { scaleai: "Scale AI", gitlab: "GitLab", mongodb: "MongoDB", hubspot: "HubSpot", doordash: "DoorDash", launchdarkly: "LaunchDarkly", pagerduty: "PagerDuty", newrelic: "New Relic", nerdwallet: "NerdWallet", cockroachlabs: "Cockroach Labs", epicgames: "Epic Games", riotgames: "Riot Games", lucidchart: "Lucid", sofi: "SoFi", gopuff: "goPuff", weride: "WeRide", BoschGroup: "Bosch", Dominos: "Domino's", ServiceNow: "ServiceNow", Equinox: "Equinox", Sodexo: "Sodexo", Experian: "Experian", Accor: "Accor", Freshworks: "Freshworks", Wise: "Wise", Canva: "Canva", openai: "OpenAI", clickup: "ClickUp", elevenlabs: "ElevenLabs", supabase: "Supabase", vanta: "Vanta", handshake: "Handshake", cursor: "Cursor", decagon: "Decagon", harvey: "Harvey", ashby: "Ashby", hex: "Hex", cloverhealth: "Clover Health", flatironhealth: "Flatiron Health", ginkgobioworks: "Ginkgo Bioworks", modernhealth: "Modern Health", omadahealth: "Omada Health", lyrahealth: "Lyra Health", includedhealth: "Included Health", renttherunway: "Rent the Runway", stitchfix: "Stitch Fix", purestorage: "Pure Storage", khanacademy: "Khan Academy", masterclass: "MasterClass", dlocal: "dLocal", wikimedia: "Wikimedia Foundation", ro: "Ro", zocdoc: "Zocdoc", sweetgreen: "Sweetgreen", warbyparker: "Warby Parker", oscar: "Oscar Health", natera: "Natera", adyen: "Adyen", waymo: "Waymo", veeva: "Veeva", mercury: "Mercury", wise: "Wise" };

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
  // Workable, Recruitee and Teamtailor: the same kind of public list, one request per company, found by searching each system for companies that
  // hire in the United States, Mexico, Colombia, Peru and remote. Left out on purpose: accounts that are recruiting agencies publishing for
  // clients they do not name (raydar: "Our client is a healthcare technology company"; workana-premium; jobgether), which would fill the search
  // with jobs nobody can tell the employer of. "<name>.na" is Teamtailor's North America address (the ones in the Americas are there).
  ...wk(`huggingface convergent-careers jeffreym-consulting energysciences nalamoney workmotion moongate-studios-inc biosked-inc ecp-123 mlabs workstate capital-economics visit`),
  ...rc(`emergentsoftware aikidosecurity hostaway careersdeltacapita tether greatminds aidigital holepunch huaweicanada bunq gsbsolutions1 constructivedialogue dillinggroup scioteq mainstream erstedigital`),
  ...tt(`spokeo.na career tradingview unleash-amby wakapi incluso iloq xci nrd upstart13 utorg sqdm.na crhtalentoenit.na bancociudad.na covalto trabajaconnosotros-olitel.na talenthub.na puelchehc.na maxusacorp.na iteriaus.na bearingpointusa.na avionsolutions.na sellersdorsey.na abceducation-1719511743.na`),
  // second round (healthcare, finance, retail, education, customer service, and the Spanish-speaking countries). Left out: nogigiddy (the same ad
  // repeated 1,822 times), hirehawk and the staffing firms.
  ...wk(`usa-vein-clinics ems-group braven assogroup hextrust marcura apogee-global-rms trivium procoffee-gear redpointglobal matador-solutions eqltech usemate sumble-inc justpark sedona-digital tecsys integrant`),
  ...rc(`iliabeauty kravet lomography sidelineswap epcvipinc bfrltd nucsai zensai`),
  ...tt(`carestar.na policyreporter.na softwarefinder.na enaexperu ocaglobal qualacompany tinet saluddigna.na ahorra.na connectassistance.na cusezar.na inhaus`),
  // third round (engineering, data and entry level in the United States; Mexico, Colombia, Argentina, Chile)
  ...wk(`alten-mexico-1 waldemar-s-nelson dacodes-mx syntiant iav-automotive-engineering globaldevgroup lucidya tarte-inc chaingpt healthcorpsorg`),
  ...rc(`heim companiongroupltd`),
  ...tt(`crunchbase.na swishanalytics.na ioet.na thestudio.na heinsohn.na global66 niryu bradescardmexico.na utec cdainformatica.na irsa.na aliancers.na vincicompass.na rooftop.na azgroup.na voolkia.na therobertemorris`),
  // SmartRecruiters: large employers of other fields (hotels, food service, gyms, industry). Its list has no description: each new posting is one more request
  ...sr(`Accor Sodexo Equinox Experian BoschGroup ServiceNow Dominos Freshworks Wise Canva`),
].map((b) => ({ ...b, name: b.name ?? NAMES[b.token] }));

// Job boards that are not one company's page but a list of many companies' jobs: Remotive (remote jobs) and Arbeitnow (Europe and remote).
// Each is one request (or a few pages) a day, within what they ask of the people who use their feeds; every job keeps its own link to apply
// and the person is told which board it came from.
BOARDS.push({ source: "remotive", token: "all", name: "Remotive" }, { source: "arbeitnow", token: "all", name: "Arbeitnow" });

/** One request per board: a full reading takes seconds. */
export const FAST_BOARDS = BOARDS.filter((b) => b.source !== "smartrecruiters" && b.source !== "computrabajo");
/** One request per new posting: read apart, with a limit of new postings per run, so it never fills a whole function call. */
export const SLOW_BOARDS = BOARDS.filter((b) => b.source === "smartrecruiters");
/** Computrabajo, read apart and slowly (see lib/ingest/computrabajo): one board is a country and a group of searches, and a run reads one board. */
export const CT_BOARDS: Board[] = CT_INGEST.flatMap((site) => Object.keys(CT_GROUPS).map((group) => ({ source: "computrabajo" as const, token: `${site}:${group}`, name: "Computrabajo" })));

