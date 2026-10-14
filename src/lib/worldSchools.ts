// The main universities of each country (by ISO code), with their city, for the school suggestions of the education step.
// The United States has its own, bigger list (see schools.ts and schoolPlaces.ts). A country that is not here has no suggestions:
// the person types the name freely.
import { US_SCHOOLS } from "@/lib/schools";
import { placeOfSchool as usPlace } from "@/lib/schoolPlaces";

// [name, "City"] under the English name of the country; the place is written "City, Country"
const RAW: Record<string, { country: string; schools: [string, string][] }> = {
  PE: { country: "Peru", schools: [
    ["Pontificia Universidad Católica del Perú", "Lima"], ["Universidad Nacional Mayor de San Marcos", "Lima"], ["Universidad Peruana Cayetano Heredia", "Lima"],
    ["Universidad del Pacífico", "Lima"], ["Universidad de Lima", "Lima"], ["Universidad Nacional de Ingeniería", "Lima"], ["Universidad Nacional Agraria La Molina", "Lima"],
    ["Universidad de Piura", "Piura"], ["Universidad Nacional de San Agustín de Arequipa", "Arequipa"], ["Universidad Católica San Pablo", "Arequipa"],
    ["Universidad Nacional de San Antonio Abad del Cusco", "Cusco"], ["Universidad Nacional de Trujillo", "Trujillo"], ["Universidad Privada del Norte", "Lima"],
    ["Universidad San Ignacio de Loyola", "Lima"], ["Universidad Peruana de Ciencias Aplicadas", "Lima"], ["Universidad ESAN", "Lima"], ["Universidad César Vallejo", "Trujillo"],
    ["Universidad Nacional Federico Villarreal", "Lima"], ["Universidad Ricardo Palma", "Lima"], ["Universidad Continental", "Huancayo"], ["Universidad Tecnológica del Perú", "Lima"],
    ["Universidad San Martín de Porres", "Lima"], ["Universidad Científica del Sur", "Lima"], ["TECSUP", "Lima"], ["SENATI", "Lima"],
  ] },
  MX: { country: "Mexico", schools: [
    ["Universidad Nacional Autónoma de México (UNAM)", "Mexico City"], ["Instituto Politécnico Nacional (IPN)", "Mexico City"], ["Tecnológico de Monterrey", "Monterrey"],
    ["Universidad Autónoma Metropolitana (UAM)", "Mexico City"], ["Universidad Iberoamericana", "Mexico City"], ["Instituto Tecnológico Autónomo de México (ITAM)", "Mexico City"],
    ["Universidad de Guadalajara", "Guadalajara"], ["Universidad Autónoma de Nuevo León (UANL)", "Monterrey"], ["Benemérita Universidad Autónoma de Puebla (BUAP)", "Puebla"],
    ["Universidad Panamericana", "Mexico City"], ["Universidad Anáhuac", "Mexico City"], ["El Colegio de México", "Mexico City"], ["CIDE", "Mexico City"],
    ["Universidad Autónoma de Yucatán", "Mérida"], ["Universidad de las Américas Puebla (UDLAP)", "Puebla"], ["Universidad La Salle", "Mexico City"],
  ] },
  CO: { country: "Colombia", schools: [
    ["Universidad Nacional de Colombia", "Bogotá"], ["Universidad de los Andes", "Bogotá"], ["Pontificia Universidad Javeriana", "Bogotá"], ["Universidad de Antioquia", "Medellín"],
    ["Universidad del Rosario", "Bogotá"], ["Universidad EAFIT", "Medellín"], ["Universidad del Valle", "Cali"], ["Universidad Externado de Colombia", "Bogotá"],
    ["Universidad Industrial de Santander", "Bucaramanga"], ["Universidad del Norte", "Barranquilla"], ["Universidad de La Sabana", "Chía"], ["Universidad Pontificia Bolivariana", "Medellín"],
    ["Universidad Santo Tomás", "Bogotá"], ["Universidad ICESI", "Cali"], ["SENA", "Bogotá"],
  ] },
  AR: { country: "Argentina", schools: [
    ["Universidad de Buenos Aires (UBA)", "Buenos Aires"], ["Universidad Nacional de La Plata", "La Plata"], ["Universidad Nacional de Córdoba", "Córdoba"],
    ["Universidad Torcuato Di Tella", "Buenos Aires"], ["Instituto Tecnológico de Buenos Aires (ITBA)", "Buenos Aires"], ["Universidad Austral", "Pilar"],
    ["Universidad Nacional de Rosario", "Rosario"], ["Universidad de San Andrés", "Victoria"], ["Universidad Tecnológica Nacional", "Buenos Aires"],
    ["Pontificia Universidad Católica Argentina", "Buenos Aires"], ["Universidad Nacional de Cuyo", "Mendoza"], ["Universidad Nacional del Sur", "Bahía Blanca"],
  ] },
  CL: { country: "Chile", schools: [
    ["Pontificia Universidad Católica de Chile", "Santiago"], ["Universidad de Chile", "Santiago"], ["Universidad de Concepción", "Concepción"],
    ["Universidad Técnica Federico Santa María", "Valparaíso"], ["Universidad Adolfo Ibáñez", "Santiago"], ["Universidad de los Andes", "Santiago"],
    ["Universidad Austral de Chile", "Valdivia"], ["Universidad de Santiago de Chile (USACH)", "Santiago"], ["Universidad Diego Portales", "Santiago"],
    ["Pontificia Universidad Católica de Valparaíso", "Valparaíso"], ["Universidad del Desarrollo", "Santiago"],
  ] },
  EC: { country: "Ecuador", schools: [
    ["Universidad San Francisco de Quito", "Quito"], ["Escuela Politécnica Nacional", "Quito"], ["Pontificia Universidad Católica del Ecuador", "Quito"],
    ["Escuela Superior Politécnica del Litoral (ESPOL)", "Guayaquil"], ["Universidad Central del Ecuador", "Quito"], ["Universidad de Cuenca", "Cuenca"],
  ] },
  BO: { country: "Bolivia", schools: [
    ["Universidad Mayor de San Andrés", "La Paz"], ["Universidad Católica Boliviana San Pablo", "La Paz"], ["Universidad Mayor de San Simón", "Cochabamba"],
    ["Universidad Privada Boliviana", "Cochabamba"], ["Universidad Autónoma Gabriel René Moreno", "Santa Cruz de la Sierra"],
  ] },
  UY: { country: "Uruguay", schools: [
    ["Universidad de la República (UdelaR)", "Montevideo"], ["Universidad Católica del Uruguay", "Montevideo"], ["Universidad ORT Uruguay", "Montevideo"],
    ["Universidad de Montevideo", "Montevideo"],
  ] },
  VE: { country: "Venezuela", schools: [
    ["Universidad Central de Venezuela", "Caracas"], ["Universidad Simón Bolívar", "Caracas"], ["Universidad Católica Andrés Bello", "Caracas"],
    ["Universidad de Los Andes", "Mérida"], ["Universidad del Zulia", "Maracaibo"],
  ] },
  CR: { country: "Costa Rica", schools: [
    ["Universidad de Costa Rica", "San José"], ["Instituto Tecnológico de Costa Rica", "Cartago"], ["Universidad Nacional de Costa Rica", "Heredia"],
    ["Universidad Latina de Costa Rica", "San José"],
  ] },
  PA: { country: "Panama", schools: [
    ["Universidad de Panamá", "Panama City"], ["Universidad Tecnológica de Panamá", "Panama City"], ["Universidad Santa María la Antigua", "Panama City"],
  ] },
  DO: { country: "Dominican Republic", schools: [
    ["Universidad Autónoma de Santo Domingo (UASD)", "Santo Domingo"], ["Instituto Tecnológico de Santo Domingo (INTEC)", "Santo Domingo"],
    ["Pontificia Universidad Católica Madre y Maestra", "Santiago de los Caballeros"], ["Universidad APEC", "Santo Domingo"],
  ] },
  GT: { country: "Guatemala", schools: [
    ["Universidad de San Carlos de Guatemala", "Guatemala City"], ["Universidad del Valle de Guatemala", "Guatemala City"], ["Universidad Rafael Landívar", "Guatemala City"],
  ] },
  PR: { country: "Puerto Rico", schools: [
    ["Universidad de Puerto Rico, Recinto de Río Piedras", "San Juan"], ["Universidad de Puerto Rico, Recinto de Mayagüez", "Mayagüez"],
    ["Pontificia Universidad Católica de Puerto Rico", "Ponce"], ["Universidad Interamericana de Puerto Rico", "San Juan"],
  ] },
  ES: { country: "Spain", schools: [
    ["Universidad de Barcelona", "Barcelona"], ["Universitat Pompeu Fabra", "Barcelona"], ["Universidad Autónoma de Madrid", "Madrid"], ["Universidad Complutense de Madrid", "Madrid"],
    ["Universidad Politécnica de Madrid", "Madrid"], ["Universidad Carlos III de Madrid", "Madrid"], ["Universitat Politècnica de Catalunya", "Barcelona"],
    ["Universitat Autònoma de Barcelona", "Barcelona"], ["Universidad de Valencia", "Valencia"], ["Universitat Politècnica de València", "Valencia"],
    ["Universidad de Navarra", "Pamplona"], ["Universidad de Granada", "Granada"], ["Universidad de Sevilla", "Seville"], ["IE University", "Madrid"], ["ESADE", "Barcelona"],
    ["IESE Business School", "Barcelona"], ["Universidad de Salamanca", "Salamanca"], ["Universidad del País Vasco", "Bilbao"], ["Universidad Pontificia Comillas", "Madrid"],
  ] },
  PT: { country: "Portugal", schools: [
    ["Universidade de Lisboa", "Lisbon"], ["Universidade do Porto", "Porto"], ["Universidade de Coimbra", "Coimbra"], ["Universidade Nova de Lisboa", "Lisbon"],
    ["Instituto Superior Técnico", "Lisbon"], ["Universidade do Minho", "Braga"], ["Universidade de Aveiro", "Aveiro"],
  ] },
  BR: { country: "Brazil", schools: [
    ["Universidade de São Paulo (USP)", "São Paulo"], ["Universidade Estadual de Campinas (Unicamp)", "Campinas"], ["Universidade Federal do Rio de Janeiro (UFRJ)", "Rio de Janeiro"],
    ["Universidade Federal de Minas Gerais (UFMG)", "Belo Horizonte"], ["Universidade Estadual Paulista (UNESP)", "São Paulo"], ["Pontifícia Universidade Católica do Rio de Janeiro (PUC-Rio)", "Rio de Janeiro"],
    ["Fundação Getulio Vargas (FGV)", "São Paulo"], ["Universidade Federal do Rio Grande do Sul (UFRGS)", "Porto Alegre"], ["Universidade de Brasília (UnB)", "Brasília"],
    ["Universidade Federal de São Paulo (UNIFESP)", "São Paulo"], ["Insper", "São Paulo"], ["Universidade Federal de Santa Catarina (UFSC)", "Florianópolis"],
  ] },
  GB: { country: "United Kingdom", schools: [
    ["University of Oxford", "Oxford"], ["University of Cambridge", "Cambridge"], ["Imperial College London", "London"], ["University College London (UCL)", "London"],
    ["London School of Economics and Political Science (LSE)", "London"], ["King's College London", "London"], ["University of Edinburgh", "Edinburgh"],
    ["University of Manchester", "Manchester"], ["University of Bristol", "Bristol"], ["University of Warwick", "Coventry"], ["University of Glasgow", "Glasgow"],
    ["Durham University", "Durham"], ["University of St Andrews", "St Andrews"], ["University of Birmingham", "Birmingham"], ["University of Leeds", "Leeds"],
    ["University of Southampton", "Southampton"], ["University of Sheffield", "Sheffield"], ["University of Nottingham", "Nottingham"], ["Queen Mary University of London", "London"],
    ["University of Bath", "Bath"], ["Cardiff University", "Cardiff"], ["Queen's University Belfast", "Belfast"], ["Loughborough University", "Loughborough"],
  ] },
  IE: { country: "Ireland", schools: [
    ["Trinity College Dublin", "Dublin"], ["University College Dublin", "Dublin"], ["University of Galway", "Galway"], ["University College Cork", "Cork"],
    ["Dublin City University", "Dublin"], ["University of Limerick", "Limerick"], ["Technological University Dublin", "Dublin"],
  ] },
  CA: { country: "Canada", schools: [
    ["University of Toronto", "Toronto"], ["McGill University", "Montreal"], ["University of British Columbia", "Vancouver"], ["University of Waterloo", "Waterloo"],
    ["McMaster University", "Hamilton"], ["University of Alberta", "Edmonton"], ["Université de Montréal", "Montreal"], ["Queen's University", "Kingston"],
    ["Western University", "London"], ["University of Calgary", "Calgary"], ["Simon Fraser University", "Burnaby"], ["York University", "Toronto"],
    ["University of Ottawa", "Ottawa"], ["Toronto Metropolitan University", "Toronto"], ["Dalhousie University", "Halifax"], ["Concordia University", "Montreal"],
    ["Université Laval", "Quebec City"], ["University of Victoria", "Victoria"], ["Seneca Polytechnic", "Toronto"], ["George Brown College", "Toronto"],
    ["Humber Polytechnic", "Toronto"], ["Centennial College", "Toronto"],
  ] },
  AU: { country: "Australia", schools: [
    ["University of Melbourne", "Melbourne"], ["Australian National University", "Canberra"], ["University of Sydney", "Sydney"], ["University of Queensland", "Brisbane"],
    ["UNSW Sydney", "Sydney"], ["Monash University", "Melbourne"], ["University of Western Australia", "Perth"], ["University of Adelaide", "Adelaide"],
    ["University of Technology Sydney", "Sydney"], ["RMIT University", "Melbourne"], ["Queensland University of Technology", "Brisbane"], ["Macquarie University", "Sydney"],
  ] },
  NZ: { country: "New Zealand", schools: [
    ["University of Auckland", "Auckland"], ["University of Otago", "Dunedin"], ["Victoria University of Wellington", "Wellington"], ["University of Canterbury", "Christchurch"],
    ["Massey University", "Palmerston North"], ["Auckland University of Technology", "Auckland"],
  ] },
  DE: { country: "Germany", schools: [
    ["Technical University of Munich", "Munich"], ["Ludwig Maximilian University of Munich", "Munich"], ["Heidelberg University", "Heidelberg"], ["Humboldt University of Berlin", "Berlin"],
    ["Technische Universität Berlin", "Berlin"], ["Freie Universität Berlin", "Berlin"], ["RWTH Aachen University", "Aachen"], ["Karlsruhe Institute of Technology", "Karlsruhe"],
    ["University of Freiburg", "Freiburg"], ["University of Tübingen", "Tübingen"], ["University of Bonn", "Bonn"], ["University of Hamburg", "Hamburg"],
    ["TU Dresden", "Dresden"], ["University of Stuttgart", "Stuttgart"], ["University of Göttingen", "Göttingen"], ["Goethe University Frankfurt", "Frankfurt"],
  ] },
  FR: { country: "France", schools: [
    ["Sorbonne Université", "Paris"], ["École Polytechnique", "Palaiseau"], ["École Normale Supérieure", "Paris"], ["Université Paris-Saclay", "Gif-sur-Yvette"],
    ["Sciences Po", "Paris"], ["HEC Paris", "Jouy-en-Josas"], ["INSEAD", "Fontainebleau"], ["CentraleSupélec", "Gif-sur-Yvette"], ["Université PSL", "Paris"],
    ["Université Grenoble Alpes", "Grenoble"], ["Université de Strasbourg", "Strasbourg"], ["Université Claude Bernard Lyon 1", "Lyon"], ["Mines Paris", "Paris"],
    ["ESSEC Business School", "Cergy"], ["ESCP Business School", "Paris"], ["Télécom Paris", "Palaiseau"],
  ] },
  IT: { country: "Italy", schools: [
    ["Politecnico di Milano", "Milan"], ["Sapienza Università di Roma", "Rome"], ["Università di Bologna", "Bologna"], ["Politecnico di Torino", "Turin"],
    ["Università degli Studi di Milano", "Milan"], ["Università di Padova", "Padua"], ["Università Bocconi", "Milan"], ["Università di Pisa", "Pisa"],
    ["Scuola Normale Superiore", "Pisa"], ["Università degli Studi di Firenze", "Florence"], ["Università di Napoli Federico II", "Naples"],
  ] },
  NL: { country: "Netherlands", schools: [
    ["Delft University of Technology", "Delft"], ["University of Amsterdam", "Amsterdam"], ["Utrecht University", "Utrecht"], ["Leiden University", "Leiden"],
    ["Eindhoven University of Technology", "Eindhoven"], ["Erasmus University Rotterdam", "Rotterdam"], ["Vrije Universiteit Amsterdam", "Amsterdam"],
    ["University of Groningen", "Groningen"], ["Wageningen University", "Wageningen"],
  ] },
  BE: { country: "Belgium", schools: [["KU Leuven", "Leuven"], ["Ghent University", "Ghent"], ["Université catholique de Louvain", "Louvain-la-Neuve"], ["Université libre de Bruxelles", "Brussels"]] },
  CH: { country: "Switzerland", schools: [
    ["ETH Zurich", "Zurich"], ["EPFL", "Lausanne"], ["University of Zurich", "Zurich"], ["University of Geneva", "Geneva"], ["University of Basel", "Basel"],
    ["University of Bern", "Bern"], ["University of St. Gallen", "St. Gallen"],
  ] },
  AT: { country: "Austria", schools: [["University of Vienna", "Vienna"], ["TU Wien", "Vienna"], ["Graz University of Technology", "Graz"], ["University of Innsbruck", "Innsbruck"]] },
  SE: { country: "Sweden", schools: [["KTH Royal Institute of Technology", "Stockholm"], ["Lund University", "Lund"], ["Uppsala University", "Uppsala"], ["Stockholm University", "Stockholm"], ["Chalmers University of Technology", "Gothenburg"]] },
  NO: { country: "Norway", schools: [["University of Oslo", "Oslo"], ["Norwegian University of Science and Technology (NTNU)", "Trondheim"], ["University of Bergen", "Bergen"]] },
  DK: { country: "Denmark", schools: [["University of Copenhagen", "Copenhagen"], ["Technical University of Denmark (DTU)", "Kongens Lyngby"], ["Aarhus University", "Aarhus"], ["Copenhagen Business School", "Copenhagen"]] },
  FI: { country: "Finland", schools: [["University of Helsinki", "Helsinki"], ["Aalto University", "Espoo"], ["University of Turku", "Turku"]] },
  PL: { country: "Poland", schools: [["University of Warsaw", "Warsaw"], ["Jagiellonian University", "Kraków"], ["Warsaw University of Technology", "Warsaw"], ["AGH University of Science and Technology", "Kraków"]] },
  CZ: { country: "Czechia", schools: [["Charles University", "Prague"], ["Czech Technical University in Prague", "Prague"], ["Masaryk University", "Brno"]] },
  GR: { country: "Greece", schools: [["National and Kapodistrian University of Athens", "Athens"], ["National Technical University of Athens", "Athens"], ["Aristotle University of Thessaloniki", "Thessaloniki"]] },
  RU: { country: "Russia", schools: [["Lomonosov Moscow State University", "Moscow"], ["Saint Petersburg State University", "Saint Petersburg"], ["Moscow Institute of Physics and Technology", "Dolgoprudny"], ["HSE University", "Moscow"]] },
  UA: { country: "Ukraine", schools: [["Taras Shevchenko National University of Kyiv", "Kyiv"], ["Kyiv Polytechnic Institute", "Kyiv"], ["Lviv Polytechnic", "Lviv"]] },
  TR: { country: "Türkiye", schools: [["Middle East Technical University", "Ankara"], ["Boğaziçi University", "Istanbul"], ["Istanbul Technical University", "Istanbul"], ["Koç University", "Istanbul"], ["Sabancı University", "Istanbul"], ["Bilkent University", "Ankara"]] },
  IL: { country: "Israel", schools: [["Technion – Israel Institute of Technology", "Haifa"], ["Hebrew University of Jerusalem", "Jerusalem"], ["Tel Aviv University", "Tel Aviv"], ["Weizmann Institute of Science", "Rehovot"], ["Ben-Gurion University of the Negev", "Beersheba"]] },
  AE: { country: "United Arab Emirates", schools: [["Khalifa University", "Abu Dhabi"], ["United Arab Emirates University", "Al Ain"], ["American University of Sharjah", "Sharjah"], ["New York University Abu Dhabi", "Abu Dhabi"], ["University of Dubai", "Dubai"]] },
  SA: { country: "Saudi Arabia", schools: [["King Abdulaziz University", "Jeddah"], ["King Fahd University of Petroleum and Minerals", "Dhahran"], ["King Saud University", "Riyadh"], ["KAUST", "Thuwal"]] },
  EG: { country: "Egypt", schools: [["Cairo University", "Cairo"], ["American University in Cairo", "Cairo"], ["Ain Shams University", "Cairo"], ["Alexandria University", "Alexandria"]] },
  ZA: { country: "South Africa", schools: [["University of Cape Town", "Cape Town"], ["University of the Witwatersrand", "Johannesburg"], ["Stellenbosch University", "Stellenbosch"], ["University of Pretoria", "Pretoria"], ["University of Johannesburg", "Johannesburg"]] },
  NG: { country: "Nigeria", schools: [["University of Ibadan", "Ibadan"], ["University of Lagos", "Lagos"], ["Obafemi Awolowo University", "Ile-Ife"], ["Covenant University", "Ota"], ["Ahmadu Bello University", "Zaria"]] },
  KE: { country: "Kenya", schools: [["University of Nairobi", "Nairobi"], ["Strathmore University", "Nairobi"], ["Kenyatta University", "Nairobi"], ["Jomo Kenyatta University of Agriculture and Technology", "Juja"]] },
  GH: { country: "Ghana", schools: [["University of Ghana", "Accra"], ["Kwame Nkrumah University of Science and Technology", "Kumasi"], ["Ashesi University", "Berekuso"]] },
  IN: { country: "India", schools: [
    ["Indian Institute of Technology Bombay", "Mumbai"], ["Indian Institute of Technology Delhi", "New Delhi"], ["Indian Institute of Technology Madras", "Chennai"],
    ["Indian Institute of Technology Kanpur", "Kanpur"], ["Indian Institute of Technology Kharagpur", "Kharagpur"], ["Indian Institute of Science", "Bengaluru"],
    ["Indian Institute of Management Ahmedabad", "Ahmedabad"], ["Indian Institute of Management Bangalore", "Bengaluru"], ["University of Delhi", "New Delhi"],
    ["Jawaharlal Nehru University", "New Delhi"], ["Anna University", "Chennai"], ["BITS Pilani", "Pilani"], ["Vellore Institute of Technology", "Vellore"],
    ["Birla Institute of Technology and Science", "Pilani"], ["Manipal Academy of Higher Education", "Manipal"], ["National Institute of Technology Trichy", "Tiruchirappalli"],
    ["University of Mumbai", "Mumbai"], ["Amity University", "Noida"], ["SRM Institute of Science and Technology", "Chennai"],
  ] },
  PK: { country: "Pakistan", schools: [["National University of Sciences and Technology (NUST)", "Islamabad"], ["Lahore University of Management Sciences (LUMS)", "Lahore"], ["University of the Punjab", "Lahore"], ["Quaid-i-Azam University", "Islamabad"]] },
  BD: { country: "Bangladesh", schools: [["University of Dhaka", "Dhaka"], ["Bangladesh University of Engineering and Technology (BUET)", "Dhaka"], ["BRAC University", "Dhaka"]] },
  LK: { country: "Sri Lanka", schools: [["University of Colombo", "Colombo"], ["University of Moratuwa", "Moratuwa"], ["University of Peradeniya", "Peradeniya"]] },
  CN: { country: "China", schools: [
    ["Tsinghua University", "Beijing"], ["Peking University", "Beijing"], ["Fudan University", "Shanghai"], ["Shanghai Jiao Tong University", "Shanghai"],
    ["Zhejiang University", "Hangzhou"], ["University of Science and Technology of China", "Hefei"], ["Nanjing University", "Nanjing"], ["Wuhan University", "Wuhan"],
    ["Harbin Institute of Technology", "Harbin"], ["Beihang University", "Beijing"], ["Sun Yat-sen University", "Guangzhou"], ["Tongji University", "Shanghai"],
    ["Renmin University of China", "Beijing"], ["Xi'an Jiaotong University", "Xi'an"], ["Huazhong University of Science and Technology", "Wuhan"],
  ] },
  HK: { country: "Hong Kong", schools: [["University of Hong Kong", "Hong Kong"], ["Chinese University of Hong Kong", "Hong Kong"], ["Hong Kong University of Science and Technology", "Hong Kong"], ["City University of Hong Kong", "Hong Kong"], ["Hong Kong Polytechnic University", "Hong Kong"]] },
  TW: { country: "Taiwan", schools: [["National Taiwan University", "Taipei"], ["National Tsing Hua University", "Hsinchu"], ["National Yang Ming Chiao Tung University", "Hsinchu"], ["National Cheng Kung University", "Tainan"]] },
  JP: { country: "Japan", schools: [
    ["University of Tokyo", "Tokyo"], ["Kyoto University", "Kyoto"], ["Osaka University", "Suita"], ["Tohoku University", "Sendai"], ["Tokyo Institute of Technology", "Tokyo"],
    ["Nagoya University", "Nagoya"], ["Kyushu University", "Fukuoka"], ["Hokkaido University", "Sapporo"], ["Waseda University", "Tokyo"], ["Keio University", "Tokyo"],
    ["Hitotsubashi University", "Tokyo"], ["Sophia University", "Tokyo"], ["Meiji University", "Tokyo"], ["Doshisha University", "Kyoto"],
  ] },
  KR: { country: "South Korea", schools: [
    ["Seoul National University", "Seoul"], ["KAIST", "Daejeon"], ["Yonsei University", "Seoul"], ["Korea University", "Seoul"], ["POSTECH", "Pohang"],
    ["Sungkyunkwan University", "Seoul"], ["Hanyang University", "Seoul"], ["UNIST", "Ulsan"], ["Kyung Hee University", "Seoul"],
  ] },
  SG: { country: "Singapore", schools: [["National University of Singapore", "Singapore"], ["Nanyang Technological University", "Singapore"], ["Singapore Management University", "Singapore"], ["Singapore University of Technology and Design", "Singapore"]] },
  MY: { country: "Malaysia", schools: [["University of Malaya", "Kuala Lumpur"], ["Universiti Putra Malaysia", "Serdang"], ["Universiti Kebangsaan Malaysia", "Bangi"], ["Universiti Teknologi Malaysia", "Johor Bahru"], ["Universiti Sains Malaysia", "George Town"]] },
  TH: { country: "Thailand", schools: [["Chulalongkorn University", "Bangkok"], ["Mahidol University", "Bangkok"], ["Chiang Mai University", "Chiang Mai"], ["Thammasat University", "Bangkok"], ["Kasetsart University", "Bangkok"]] },
  VN: { country: "Vietnam", schools: [["Vietnam National University, Hanoi", "Hanoi"], ["Vietnam National University, Ho Chi Minh City", "Ho Chi Minh City"], ["Hanoi University of Science and Technology", "Hanoi"], ["FPT University", "Hanoi"]] },
  ID: { country: "Indonesia", schools: [["Universitas Indonesia", "Depok"], ["Institut Teknologi Bandung", "Bandung"], ["Gadjah Mada University", "Yogyakarta"], ["Bogor Agricultural University (IPB)", "Bogor"], ["Airlangga University", "Surabaya"]] },
  PH: { country: "Philippines", schools: [["University of the Philippines Diliman", "Quezon City"], ["Ateneo de Manila University", "Quezon City"], ["De La Salle University", "Manila"], ["University of Santo Tomas", "Manila"], ["Mapúa University", "Manila"]] },
};

import { fold } from "@/lib/fold";

/** The ISO codes that have a catalog (the United States included). */
export const SCHOOL_COUNTRIES: string[] = ["US", ...Object.keys(RAW)];

/** Names of the main schools of a country; empty when there is no catalog for it. */
export function schoolsOf(iso?: string): string[] {
  if (!iso) return [];
  if (iso === "US") return US_SCHOOLS;
  return (RAW[iso]?.schools ?? []).map(([n]) => n);
}

/** Names of every school of every country, for when the person does not say which country. */
export function allSchools(): string[] {
  return Array.from(new Set([...US_SCHOOLS, ...Object.values(RAW).flatMap((c) => c.schools.map(([n]) => n))]));
}

const PLACES = new Map<string, string>();
for (const c of Object.values(RAW)) for (const [n, city] of c.schools) PLACES.set(fold(n), `${city}, ${c.country}`);

/** "Lima, Peru" or "Newark, NJ" for a school of the catalogs, or "" when it is not a known one. */
export const placeOfSchool = (name?: string): string => usPlace(name) || PLACES.get(fold(name ?? "")) || "";

/** The country (ISO) of a school of the catalogs, or "" when it is not a known one. */
export function countryOfSchool(name?: string): string {
  const f = fold(name ?? "");
  if (!f) return "";
  if (usPlace(name)) return "US";
  for (const [iso, c] of Object.entries(RAW)) if (c.schools.some(([n]) => fold(n) === f)) return iso;
  return "";
}
