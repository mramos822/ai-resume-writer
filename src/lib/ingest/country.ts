// The country a job is in, from how its place is written ("Newark, NJ", "London, , United Kingdom", "Remote - India", "Bengaluru").
// The boards write the place as free text; this gives the search a country to filter by. Unknown stays unknown (undefined): a job whose
// place says nothing clear (Remote, Hybrid, Multiple locations) is never taken for another country's.

const US_STATES = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "));
const US_STATE_NAMES = /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|d\.c\.)\b/i;

/** Two letter country codes people write after a city, other than the ones that are also US states. */
const CODES = new Set("CH GB UK AU NZ SG JP KR CN HK TW BR MX CL FR ES IT NL BE SE NO DK FI PL RO CZ HU GR TR AE SA ZA NG KE PH MY TH VN PK UA PT AT IE QA".split(" "));

/** Country names (and the usual short forms) as they appear in a place, with their ISO code. */
const NAMES: [RegExp, string][] = [
  [/\b(united states|usa|u\.s\.a?\.?|us)\b/i, "US"],
  [/\b(united kingdom|uk|england|scotland|wales|northern ireland|great britain)\b/i, "GB"],
  [/\bcanada\b/i, "CA"], [/\baustralia\b/i, "AU"], [/\bnew zealand\b/i, "NZ"], [/\bireland\b/i, "IE"], [/\bindia\b/i, "IN"], [/\bsingapore\b/i, "SG"],
  [/\bgermany|deutschland\b/i, "DE"], [/\bfrance\b/i, "FR"], [/\bspain|españa\b/i, "ES"], [/\bportugal\b/i, "PT"], [/\bitaly|italia\b/i, "IT"],
  [/\bnetherlands|holland\b/i, "NL"], [/\bbelgium\b/i, "BE"], [/\bswitzerland\b/i, "CH"], [/\baustria\b/i, "AT"], [/\bsweden\b/i, "SE"], [/\bnorway\b/i, "NO"],
  [/\bdenmark\b/i, "DK"], [/\bfinland\b/i, "FI"], [/\bpoland\b/i, "PL"], [/\bromania\b/i, "RO"], [/\bczech/i, "CZ"], [/\bhungary\b/i, "HU"], [/\bgreece\b/i, "GR"],
  [/\bturk(ey|iye)\b/i, "TR"], [/\bisrael\b/i, "IL"], [/\b(uae|united arab emirates)\b/i, "AE"], [/\bsaudi/i, "SA"], [/\begypt\b/i, "EG"], [/\bsouth africa\b/i, "ZA"],
  [/\bnigeria\b/i, "NG"], [/\bkenya\b/i, "KE"], [/\bjapan\b/i, "JP"], [/\bchina\b/i, "CN"], [/\bhong kong\b/i, "HK"], [/\btaiwan\b/i, "TW"], [/\b(south )?korea\b/i, "KR"],
  [/\bphilippines\b/i, "PH"], [/\bindonesia\b/i, "ID"], [/\bmalaysia\b/i, "MY"], [/\bthailand\b/i, "TH"], [/\bvietnam\b/i, "VN"], [/\bpakistan\b/i, "PK"],
  [/\bbrazil|brasil\b/i, "BR"], [/\bmexico|méxico\b/i, "MX"], [/\bargentina\b/i, "AR"], [/\bcolombia\b/i, "CO"], [/\bchile\b/i, "CL"], [/\bperu|perú\b/i, "PE"],
  [/\buruguay\b/i, "UY"], [/\bcosta rica\b/i, "CR"], [/\bpanama\b/i, "PA"], [/\becuador\b/i, "EC"], [/\bslovenia\b/i, "SI"], [/\bslovakia\b/i, "SK"], [/\bbulgaria\b/i, "BG"],
  [/\bqatar\b/i, "QA"], [/\bkuwait\b/i, "KW"], [/\bjordan\b/i, "JO"], [/\bmorocco\b/i, "MA"], [/\bghana\b/i, "GH"], [/\bbangladesh\b/i, "BD"], [/\bsri lanka\b/i, "LK"], [/\bnepal\b/i, "NP"],
  [/\bIND\b/, "IN"], [/\bGBR\b/, "GB"], [/\bCAN\b/, "CA"], [/\bAUS\b/, "AU"], [/\bDEU\b/, "DE"], [/\bFRA\b/, "FR"], [/\bBRA\b/, "BR"], [/\bMEX\b/, "MX"],
  [/\bukraine\b/i, "UA"], [/\bserbia\b/i, "RS"], [/\bcroatia\b/i, "HR"], [/\bestonia\b/i, "EE"], [/\blatvia\b/i, "LV"], [/\blithuania\b/i, "LT"], [/\bluxembourg\b/i, "LU"],
];

/** Cities that say their country by themselves (when the place has no country written). */
const CITIES: [RegExp, string][] = [
  [/\b(london|manchester|edinburgh|bristol|cambridge, uk|belfast|glasgow|leeds)\b/i, "GB"], [/\b(dublin|cork|galway)\b/i, "IE"],
  [/\b(toronto|vancouver|montreal|ottawa|calgary|waterloo|kitchener)\b/i, "CA"], [/\b(bengaluru|bangalore|hyderabad|mumbai|delhi|gurgaon|gurugram|noida|pune|chennai|kolkata)\b/i, "IN"],
  [/\b(sydney|melbourne|brisbane|perth|canberra)\b/i, "AU"], [/\b(tokyo|osaka)\b/i, "JP"], [/\b(paris|lyon|marseille)\b/i, "FR"], [/\b(berlin|munich|münchen|hamburg|frankfurt|cologne)\b/i, "DE"],
  [/\b(amsterdam|rotterdam|utrecht)\b/i, "NL"], [/\b(madrid|barcelona)\b/i, "ES"], [/\b(lisbon|porto)\b/i, "PT"], [/\b(warsaw|krakow|wroclaw)\b/i, "PL"], [/\b(zurich|geneva)\b/i, "CH"],
  [/\b(tel aviv)\b/i, "IL"], [/\b(dubai|abu dhabi)\b/i, "AE"], [/\b(são paulo|sao paulo|rio de janeiro|curitiba|campinas)\b/i, "BR"], [/\b(mexico city|ciudad de méxico|guadalajara|monterrey|querétaro|aguascalientes)\b/i, "MX"],
  [/\b(bucharest|cluj)\b/i, "RO"], [/\b(stockholm|gothenburg|malm[oö])\b/i, "SE"], [/\b(oslo)\b/i, "NO"], [/\b(copenhagen)\b/i, "DK"], [/\b(helsinki)\b/i, "FI"], [/\b(prague)\b/i, "CZ"],
  [/\b(budapest)\b/i, "HU"], [/\b(vienna|wien)\b/i, "AT"], [/\b(brussels|antwerp)\b/i, "BE"], [/\b(milan|rome|turin)\b/i, "IT"], [/\b(kyiv|kiev)\b/i, "UA"], [/\b(athens)\b/i, "GR"], [/\b(istanbul|ankara)\b/i, "TR"],
  [/\b(nairobi)\b/i, "KE"], [/\b(lagos)\b/i, "NG"], [/\b(cairo)\b/i, "EG"], [/\b(johannesburg|cape town)\b/i, "ZA"], [/\b(manila)\b/i, "PH"], [/\b(jakarta)\b/i, "ID"], [/\b(kuala lumpur)\b/i, "MY"], [/\b(bangkok)\b/i, "TH"],
  [/\b(hanoi|ho chi minh)\b/i, "VN"], [/\b(taipei)\b/i, "TW"], [/\b(karachi|lahore|islamabad)\b/i, "PK"], [/\b(doha)\b/i, "QA"], [/\b(riyadh|jeddah)\b/i, "SA"], [/\b(mohali|chandigarh|ahmedabad|jaipur|kochi)\b/i, "IN"],
  [/\b(buenos aires)\b/i, "AR"], [/\b(bogot[aá]|medell[ií]n)\b/i, "CO"], [/\b(santiago)\b/i, "CL"], [/\b(lima)\b/i, "PE"], [/\b(seoul)\b/i, "KR"], [/\b(shanghai|beijing|shenzhen)\b/i, "CN"],
  [/\b(new york( city)?|nyc|san francisco|seattle|austin|boston|chicago|los angeles|denver|atlanta|miami|dallas|houston|portland|san diego|san jose|palo alto|mountain view|sunnyvale|menlo park|redwood city|philadelphia|pittsburgh|phoenix|salt lake city|raleigh|nashville|minneapolis|washington, d\.?c\.?|brooklyn|bay area)\b/i, "US"],
];

/** True when the place is only a country ("United States", "Canada"), with no city: a posting placed like that is usually open to the whole country. */
export function isCountryName(place: string): boolean {
  const p = place.trim();
  if (!p || /,/.test(p)) return false;
  return NAMES.some(([re]) => {
    const m = re.exec(p);
    return !!m && m[0].length === p.length;
  });
}

/**
 * `hint` is what the board says when it says it (a two letter code, or a country name): it wins. Otherwise the place is read:
 * a country name, then a city that says it, then a US state ("Newark, NJ").
 */
export function countryOf(place: string, hint?: string): string | undefined {
  const h = (hint ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(h)) return h.toUpperCase();
  const text = `${h} ${place}`.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  // "Remote - US", "United States | Remote": the country is the one named
  for (const [re, code] of NAMES) if (re.test(text)) return code;
  for (const [re, code] of CITIES) if (re.test(text)) return code;
  // "Newark, NJ" or "Austin, TX, US": a US state written as two capital letters after a comma (or alone at the end)
  const abbr = /(?:,|\s)\s*([A-Z]{2})\b(?:\s*(?:,|\||;|\(|$))/.exec(place);
  if (abbr && US_STATES.has(abbr[1])) return "US";
  if (US_STATE_NAMES.test(place)) return "US";
  // "Zürich, CH": a country code after a comma, when it is not also a US state ("CA", "DE", "IN"... are states: those were read above)
  const code = /,\s*([A-Z]{2})\s*$/.exec(place)?.[1];
  if (code && CODES.has(code)) return code === "UK" ? "GB" : code;
  return undefined;
}
