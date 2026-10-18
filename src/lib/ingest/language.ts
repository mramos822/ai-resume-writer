// The language a job posting is written in, so the search can leave out the ones the person cannot read (a hotel in Paris posts in French).
// It counts the most common words of each language. When it is not clear, the posting counts as English: a job is never hidden by a doubt.
export type PostingLang = "en" | "es" | "fr" | "de" | "pt" | "it";

const words = (s: string) => new Set(s.split(/\s+/).filter(Boolean));
const WORDS: Record<PostingLang, Set<string>> = {
  en: words("the and of to in for with is are you your our we will be as on at by an or this that from have has it their about work team experience role skills ability who what can all more"),
  es: words("el los las del para con una que es su al como más experiencia equipo trabajo empresa puesto nuestro nuestra serás tu tus por sobre entre también"),
  fr: words("le les des du et pour dans que est sont vous nous votre notre avec sur aux par ce cette expérience équipe poste vos nos être ou où qui"),
  de: words("der die das und ist sind für mit von zu den dem ein eine auf im wir sie ihre unser erfahrung aufgaben bei oder als nicht werden auch sich"),
  pt: words("os as do da dos das em uma para com que são você nós sua nosso experiência equipe vaga não também sobre mais"),
  it: words("il gli di del della e in un una per con che è sono voi noi vostro nostra esperienza squadra anche più come"),
};

/** "en" when it is English or not clear; another language only when it clearly wins (at least 6 common words and clearly more than English). */
export function detectLanguage(text: string): PostingLang {
  const score: Record<PostingLang, number> = { en: 0, es: 0, fr: 0, de: 0, pt: 0, it: 0 };
  for (const w of text.toLowerCase().slice(0, 2500).split(/[^a-záéíóúñüàâçèêëîïôûùœäößãõì]+/)) {
    if (!w) continue;
    for (const l of Object.keys(WORDS) as PostingLang[]) if (WORDS[l].has(w)) score[l]++;
  }
  let best: PostingLang = "en";
  for (const l of Object.keys(score) as PostingLang[]) if (score[l] > score[best]) best = l;
  if (best === "en") return "en";
  const second = Math.max(...(Object.keys(score) as PostingLang[]).filter((l) => l !== best).map((l) => score[l]));
  return score[best] >= 6 && score[best] >= second * 1.4 ? best : "en";
}
