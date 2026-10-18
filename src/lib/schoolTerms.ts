// Search by acronym or nickname: "NJIT", "PUCP", "Georgia Tech" find the school they stand for.
import { fold } from "@/lib/fold";

const STOP = new Set(["of", "the", "and", "at", "in", "for", "a", "de", "del", "la", "las", "los", "el", "y", "e", "para", "da", "do", "dos", "di", "du", "des", "van", "von", "der", "den", "et"]);

/** "New Jersey Institute of Technology" -> "NJIT"; "Pontificia Universidad Católica del Perú" -> "PUCP". */
function initials(name: string): string {
  const base = name.replace(/\(.*?\)/g, " ").replace(/[:–—-]/g, " ");
  return base
    .split(/[\s,]+/)
    .filter((w) => w && !STOP.has(fold(w)))
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// the names people really use, which are not just the initials
const NICKNAMES: Record<string, string[]> = {
  "Massachusetts Institute of Technology": ["MIT"],
  "Georgia Institute of Technology": ["Georgia Tech", "GT"],
  "California Institute of Technology": ["Caltech"],
  "University of California, Berkeley": ["UC Berkeley", "UCB", "Cal"],
  "University of California, Los Angeles": ["UCLA"],
  "University of California, San Diego": ["UCSD"],
  "University of California, Davis": ["UC Davis", "UCD"],
  "University of California, Irvine": ["UC Irvine", "UCI"],
  "University of California, Santa Barbara": ["UCSB"],
  "University of California, Santa Cruz": ["UCSC"],
  "University of California, Riverside": ["UCR"],
  "University of California, Merced": ["UC Merced", "UCM"],
  "University of Texas at Austin": ["UT Austin", "UT"],
  "University of Texas at Dallas": ["UT Dallas", "UTD"],
  "University of Texas at Arlington": ["UT Arlington", "UTA"],
  "University of Texas at San Antonio": ["UTSA"],
  "University of Texas at El Paso": ["UTEP"],
  "Texas A&M University": ["TAMU", "A&M"],
  "University of Illinois Urbana-Champaign": ["UIUC", "Illinois"],
  "University of Illinois Chicago": ["UIC"],
  "University of Michigan": ["UMich", "U of M"],
  "University of Maryland, College Park": ["UMD"],
  "University of Maryland, Baltimore County": ["UMBC"],
  "University of Washington": ["UW", "UDub"],
  "University of Wisconsin-Madison": ["UW Madison", "UW-Madison"],
  "University of Pennsylvania": ["UPenn", "Penn"],
  "Penn State University": ["Penn State", "PSU"],
  "Ohio State University": ["OSU", "Ohio State"],
  "Arizona State University": ["ASU"],
  "University of Central Florida": ["UCF"],
  "University of North Carolina at Chapel Hill": ["UNC", "UNC Chapel Hill"],
  "University of North Carolina at Charlotte": ["UNCC", "UNC Charlotte"],
  "North Carolina State University": ["NC State", "NCSU"],
  "Florida State University": ["FSU"],
  "Florida International University": ["FIU"],
  "Florida Atlantic University": ["FAU"],
  "University of South Florida": ["USF"],
  "Virginia Commonwealth University": ["VCU"],
  "Virginia Tech": ["VT"],
  "Rutgers University-New Brunswick": ["Rutgers", "RU"],
  "Rutgers University-Newark": ["Rutgers Newark"],
  "New York University": ["NYU"],
  "University of Southern California": ["USC"],
  "Boston University": ["BU"],
  "Boston College": ["BC"],
  "Carnegie Mellon University": ["CMU"],
  "Rensselaer Polytechnic Institute": ["RPI"],
  "Rochester Institute of Technology": ["RIT"],
  "Worcester Polytechnic Institute": ["WPI"],
  "Illinois Institute of Technology": ["IIT"],
  "Brigham Young University": ["BYU"],
  "Southern Methodist University": ["SMU"],
  "Texas Christian University": ["TCU"],
  "Louisiana State University": ["LSU"],
  "Texas Tech University": ["TTU", "Texas Tech"],
  "Washington University in St. Louis": ["WashU", "WUSTL"],
  "George Washington University": ["GWU", "GW"],
  "Johns Hopkins University": ["JHU", "Hopkins"],
  "University of Pittsburgh": ["Pitt"],
  "Stony Brook University": ["SBU"],
  "University at Buffalo": ["UB"],
  "City College of New York": ["CCNY"],
  "Cal Poly San Luis Obispo": ["Cal Poly SLO"],
  "San Jose State University": ["SJSU"],
  "San Diego State University": ["SDSU"],
  "San Francisco State University": ["SFSU", "SF State"],
  "University of Colorado Boulder": ["CU Boulder"],
  "University of Colorado Denver": ["CU Denver"],
  "Miami Dade College": ["MDC"],
  "Northern Virginia Community College": ["NOVA", "NVCC"],
  "United States Military Academy (West Point)": ["West Point", "USMA"],
  "United States Naval Academy": ["Annapolis", "USNA"],
  "Tecnológico de Monterrey": ["ITESM", "Tec de Monterrey", "TEC"],
  "Instituto Politécnico Nacional (IPN)": ["Poli"],
  "Pontificia Universidad Católica de Chile": ["UC Chile", "PUC", "PUC Chile"],
  "Universidad de los Andes": ["Uniandes"],
  "Universidad Nacional de Colombia": ["UNAL"],
  "Pontificia Universidad Javeriana": ["Javeriana", "PUJ"],
  "Universidad Nacional de Ingeniería": ["UNI"],
  "Universidad Nacional Mayor de San Marcos": ["San Marcos"],
  "Pontificia Universidad Católica del Perú": ["La Católica", "Catolica"],
  "Universidad Peruana Cayetano Heredia": ["Cayetano"],
  "Universidad Nacional Agraria La Molina": ["UNALM", "La Molina"],
  "Universidad Científica del Sur": ["UCSUR", "Cientifica"],
  "Universidad Nacional Federico Villarreal": ["Villarreal"],
  "Universidad de Costa Rica": ["UCR"],
  "Universidad de Chile": ["UChile"],
  "Universidad Complutense de Madrid": ["Complutense"],
  "Universidad Carlos III de Madrid": ["UC3M"],
  "University of Oxford": ["Oxford"],
  "University of Cambridge": ["Cambridge"],
  "Imperial College London": ["Imperial", "ICL"],
  "King's College London": ["KCL"],
  "Queen Mary University of London": ["QMUL"],
  "University of Toronto": ["UofT", "U of T"],
  "University of British Columbia": ["UBC"],
  "University of Waterloo": ["UWaterloo", "Waterloo"],
  "Toronto Metropolitan University": ["TMU", "Ryerson"],
  "UNSW Sydney": ["UNSW"],
  "Australian National University": ["ANU"],
  "Technical University of Munich": ["TUM"],
  "Ludwig Maximilian University of Munich": ["LMU"],
  "RWTH Aachen University": ["RWTH"],
  "Karlsruhe Institute of Technology": ["KIT"],
  "ETH Zurich": ["ETH"],
  "Delft University of Technology": ["TU Delft", "TUDelft"],
  "Indian Institute of Technology Bombay": ["IIT Bombay", "IITB"],
  "Indian Institute of Technology Delhi": ["IIT Delhi", "IITD"],
  "Indian Institute of Technology Madras": ["IIT Madras", "IITM"],
  "Indian Institute of Technology Kanpur": ["IIT Kanpur", "IITK"],
  "Indian Institute of Technology Kharagpur": ["IIT Kharagpur", "IITKGP"],
  "Indian Institute of Science": ["IISc"],
  "Birla Institute of Technology and Science": ["BITS"],
  "Vellore Institute of Technology": ["VIT"],
  "National University of Singapore": ["NUS"],
  "Nanyang Technological University": ["NTU"],
  "University of Hong Kong": ["HKU"],
  "Hong Kong University of Science and Technology": ["HKUST"],
  "Chinese University of Hong Kong": ["CUHK"],
  "Shanghai Jiao Tong University": ["SJTU"],
  "University of Science and Technology of China": ["USTC"],
  "Seoul National University": ["SNU"],
  "University of Tokyo": ["UTokyo", "Todai"],
  "Kyoto University": ["Kyodai"],
  "Tokyo Institute of Technology": ["Tokyo Tech"],
  "University of Cape Town": ["UCT"],
  "University of the Witwatersrand": ["Wits"],
  "Middle East Technical University": ["METU", "ODTU"],
};

const NICK = new Map<string, string[]>(Object.entries(NICKNAMES).map(([n, a]) => [fold(n), a]));

/** The short names a school is known by: its initials (NJIT, PUCP), what is in parentheses (UNAM) and common nicknames (Georgia Tech). */
export function schoolTerms(name: string): string[] {
  const out = new Set<string>();
  const ini = initials(name);
  if (ini.length >= 2 && ini.length <= 8) out.add(ini);
  for (const m of name.matchAll(/\(([^)]{2,12})\)/g)) out.add(m[1]);
  for (const a of NICK.get(fold(name)) ?? []) out.add(a);
  return Array.from(out);
}
