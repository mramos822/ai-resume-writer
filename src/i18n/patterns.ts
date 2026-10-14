// Sentences written by code with numbers and names in them (the review's reasons): each pattern gives the Spanish sentence.
// The dictionary (i18n/es) holds the sentences that never change; these are the ones that do.
type Rule = [RegExp, (m: RegExpExecArray) => string];

const PARTS: Record<string, string> = {
  name: "nombre",
  email: "correo",
  phone: "teléfono",
  location: "ubicación",
  "two-column layout": "diseño de dos columnas",
  photo: "foto",
  "skill rating graphics": "gráficos de calificación de habilidades",
};
const parts = (list: string) => list.split(/,\s*/).map((p) => PARTS[p] ?? p).join(", ");
const s = (n: string | number, one: string, many: string) => (Number(n) === 1 ? one : many);

export const ES_PATTERNS: Rule[] = [
  [/^Missing: (.+)\.$/, (m) => `Falta: ${parts(m[1])}.`],
  [/^(\d+) characters: a proper introduction\.$/, (m) => `${m[1]} caracteres: una presentación adecuada.`],
  [/^(\d+) characters; aim for 250 to 700 \(3 to 5 sentences\)\.$/, (m) => `${m[1]} caracteres; procura entre 250 y 700 (de 3 a 5 frases).`],
  [/^(\d+) skills\.$/, (m) => `${m[1]} ${s(m[1], "habilidad", "habilidades")}.`],
  [/^(\d+) skills; aim for 8 or more\.$/, (m) => `${m[1]} ${s(m[1], "habilidad", "habilidades")}; procura tener 8 o más.`],
  [/^(\d+) of your (\d+) skills also show up in your experience, projects or studies\.$/, (m) => `${m[1]} de tus ${m[2]} habilidades también aparecen en tu experiencia, proyectos o estudios.`],
  [/^(\d+)% of the keywords for (.+) are on your resume\.$/, (m) => `El ${m[1]} % de las palabras clave para ${m[2]} están en tu currículum.`],
  [/^(\d+)% of the keywords for (.+)\. Missing: (.+)\.$/, (m) => `El ${m[1]} % de las palabras clave para ${m[2]}. Faltan: ${m[3]}.`],
  [/^(\d+) experience entries kept\.$/, (m) => `${m[1]} entradas de experiencia conservadas.`],
  [/^Only (\d+); keep your (\d+) most recent roles\.$/, (m) => `Solo ${m[1]}; conserva tus ${m[2]} puestos más recientes.`],
  [/^(\d+) gaps? over 6 months between jobs\.$/, (m) => `${m[1]} ${s(m[1], "vacío", "vacíos")} de más de 6 meses entre empleos.`],
  [/^(\d+) of your (\d+) recent jobs related to (.+) have 3 to 5 bullets\.$/, (m) => `${m[1]} de tus ${m[2]} empleos recientes relacionados con ${m[3]} tienen de 3 a 5 viñetas.`],
  [/^(\d+) of (\d+) bullets are too short or too long\.$/, (m) => `${m[1]} de ${m[2]} viñetas son demasiado cortas o demasiado largas.`],
  [/^(\d+) bullets? start with a weak phrase\.$/, (m) => `${m[1]} ${s(m[1], "viñeta empieza", "viñetas empiezan")} con una frase débil.`],
  [/^(\d+)% of your recent bullets contain a number\.$/, (m) => `El ${m[1]} % de tus viñetas recientes contiene un número.`],
  [/^ATS may struggle with: (.+)\.$/, (m) => `Los ATS pueden tener problemas con: ${parts(m[1])}.`],
  [/^(\d+) repeated entr(?:y|ies)\.$/, (m) => `${m[1]} ${s(m[1], "entrada repetida", "entradas repetidas")}.`],
  [/^(\d+) of (\d+) jobs have a start date\.$/, (m) => `${m[1]} de ${m[2]} empleos tienen fecha de inicio.`],
];
