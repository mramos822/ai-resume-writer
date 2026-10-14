// The looks a resume can have. One list for the server (PDF), the previews and every screen that lets the person choose.
export const TEMPLATE_IDS = ["classic", "modern", "creative", "essential", "executive", "tech", "minimal", "elegant", "sidebar", "timeline", "legal", "press", "health", "corporate", "warm", "rirekisho", "shokumu", "academic", "halftone", "ats", "banner", "noir", "blossom", "pastel", "atelier"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const asTemplateId = (t: unknown): TemplateId => ((TEMPLATE_IDS as readonly unknown[]).includes(t) ? (t as TemplateId) : "classic");
export const isTemplateId = (t: unknown): t is TemplateId => (TEMPLATE_IDS as readonly unknown[]).includes(t);

/** Looks that put content in two columns or draw graphics: the ones an applicant tracking system may struggle with. */
export const TWO_COLUMN: readonly TemplateId[] = ["modern", "creative", "sidebar", "noir", "blossom", "pastel", "atelier"];

/** Looks that can draw how confident the person is with each skill (stars, bars or dots). The others write the skills as plain text. */
export const SKILL_LEVEL_TEMPLATES: readonly TemplateId[] = ["classic", "modern", "creative", "sidebar", "blossom", "pastel"];
/** An empty or unknown look counts as supported: nothing has been chosen yet. */
export const supportsSkillLevels = (t: unknown): boolean => !isTemplateId(t) || SKILL_LEVEL_TEMPLATES.includes(t);

/**
 * Every look has room for a profile photo. The shape is part of the design: a circle fits the soft headers, a rounded square suits the
 * techy and the modern looks, and a square portrait sits well on the executive band.
 */
export type PhotoShape = "circle" | "rounded" | "square";
export const PHOTO_SHAPE: Record<TemplateId, PhotoShape> = {
  classic: "circle",
  modern: "rounded",
  creative: "circle",
  essential: "circle",
  executive: "square",
  tech: "rounded",
  minimal: "circle",
  elegant: "square",
  sidebar: "circle",
  timeline: "rounded",
  legal: "square",
  press: "rounded",
  health: "circle",
  corporate: "rounded",
  warm: "circle",
  rirekisho: "square",
  shokumu: "square",
  academic: "circle",
  halftone: "circle",
  ats: "circle",
  banner: "circle",
  noir: "circle",
  blossom: "circle",
  pastel: "circle",
  atelier: "circle",
};

/** The looks that leave the photo out on purpose (an ATS reads text, a Japanese career history has no photo). */
export const NO_PHOTO_TEMPLATES: readonly TemplateId[] = ["ats", "shokumu", "academic"];
export const supportsPhoto = (t: unknown): boolean => !(NO_PHOTO_TEMPLATES as readonly unknown[]).includes(t);
export const photoShapeOf = (t: unknown): PhotoShape => PHOTO_SHAPE[asTemplateId(t)];
/** Corner radius as a share of the photo's side: a circle is half of it. */
export const PHOTO_RADIUS: Record<PhotoShape, number> = { circle: 0.5, rounded: 0.2, square: 0.04 };

/**
 * The three looks people choose most today (the plain ATS standard, the balanced modern one and the traditional classic).
 * They get a "Popular" ribbon wherever a look is chosen. Review this list now and then.
 */
export const POPULAR_TEMPLATES: readonly TemplateId[] = ["essential", "modern", "classic"];
export const isPopularTemplate = (t: unknown): boolean => (POPULAR_TEMPLATES as readonly unknown[]).includes(t);

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  /** one line for the picker */
  description: string;
  /** a sentence for the landing page: who it is for */
  blurb: string;
}

export const TEMPLATES: TemplateInfo[] = [
  { id: "classic", name: "Classic (Default)", description: "A timeless, professional resume template.", blurb: "Traditional and timeless. Ideal for finance, law and corporate." },
  { id: "modern", name: "Modern", description: "A stylish, contemporary resume template.", blurb: "Clean and confident. Great for tech, startups and design roles." },
  { id: "creative", name: "Creative", description: "A bold, artistic resume template for creative professionals.", blurb: "Bold and expressive. Perfect for standing out in creative fields." },
  { id: "essential", name: "Essential", description: "The plain, ATS-first standard: one column and clear headings.", blurb: "The plain standard: one column, clear headings, nothing that can confuse an applicant tracking system. Safe for any application." },
  { id: "executive", name: "Executive", description: "A confident navy header for senior and leadership roles.", blurb: "A confident navy header and a strong, calm layout. Built for senior, management and leadership roles." },
  { id: "tech", name: "Tech", description: "Skills as chips and projects up front, for engineers.", blurb: "Developer-friendly: skills as chips and projects before experience. For software, data and engineering roles." },
  { id: "minimal", name: "Minimal", description: "Airy and quiet: lots of white space, no lines.", blurb: "Airy and quiet: plenty of white space and no decoration. Lets your experience speak for itself." },
  { id: "elegant", name: "Elegant", description: "A serif look with a refined double rule.", blurb: "A refined serif look with a double rule under the name. For law, consulting, academia and the arts." },
  { id: "sidebar", name: "Sidebar", description: "A dark side column for contact and skills.", blurb: "A dark side column holds your photo, contact, skills and languages, and the story goes on the right." },
  { id: "timeline", name: "Timeline", description: "Your path on a vertical line, with blue accents.", blurb: "Your experience and studies hang from a vertical timeline, so your career path reads at a glance." },
  { id: "legal", name: "Legal", description: "Formal serif with the name on the left and contact on the right.", blurb: "Formal and sober: serif type, education first and a strong rule. For law, notaries, public service and the judiciary." },
  { id: "press", name: "Press", description: "An editorial masthead for journalists and communicators.", blurb: "An editorial masthead with a big serif name between rules. For journalism, communications, publishing and media." },
  { id: "health", name: "Health", description: "Clean and calm, with a soft colored header.", blurb: "Clean and reassuring, with a soft colored header and education first. For medicine, nursing, dentistry, psychology and other health careers." },
  { id: "corporate", name: "Corporate", description: "Section names in a left column, content on the right.", blurb: "A tidy layout with the section names in a left column. For administration, accounting, finance, banking and business." },
  { id: "warm", name: "Warm", description: "Friendly, with a big photo and rounded section tags.", blurb: "Friendly and approachable, with a big photo and rounded section tags. For teaching, social work, human resources and care professions." },
  { id: "rirekisho", name: "Rirekisho", description: "The Japanese resume form: a grid with a photo frame and a year and month history.", blurb: "The classic Japanese resume form (rirekisho): a ruled grid with a photo frame, your details in boxes and a year-and-month history of studies and jobs." },
  { id: "shokumu", name: "Shokumu", description: "A Japanese career history (shokumukeirekisho), one table per job.", blurb: "A Japanese career history sheet (shokumukeirekisho): a career summary and one table per job with its duties and results. Plain and easy for an ATS." },
  { id: "academic", name: "Academic", description: "Serif type with the years in a column at the left.", blurb: "A scholarly look: serif type, a centered name and the years in a column at the left of every entry. For teaching, research, science and the public sector." },
  { id: "halftone", name: "Half Tone", description: "A halftone dot pattern in the header.", blurb: "A halftone dot pattern fades across the header and into the section titles. A graphic, print-inspired look." },
  { id: "banner", name: "Banner", description: "A soft banner with a round photo and the name on a color band.", blurb: "A soft banner holds your contact, a round photo overlaps a band of color with your name, and the sections sit in a tidy left column. Works well when you are starting out." },
  { id: "noir", name: "Noir", description: "A dark band with a round photo and a light side column.", blurb: "A dark band across the top holds your name beside a round photo, a light column carries your contact and skills, and your story runs on the right with dots. Bold and tidy." },
  { id: "blossom", name: "Blossom", description: "Soft peach tones, rounded tags and a timeline.", blurb: "Warm, soft colors with an arch behind your photo, rounded section tags and a vertical timeline for your experience. Friendly and creative." },
  { id: "pastel", name: "Pastel", description: "A bold name and soft shapes in the corners.", blurb: "A big bold name, a summary up front and soft colored shapes in the corners, with your details and skills in a narrow column. Fresh and modern." },
  { id: "atelier", name: "Atelier", description: "A monogram, a spaced name and two clean columns.", blurb: "A monogram and a spaced name over two clean columns in calm slate tones. Light, precise and easy to read." },
  { id: "ats", name: "Pure ATS", description: "Plain text only: no colors, no photo, no graphics.", blurb: "Nothing but text: one column, standard section names, no colors, no photo and no graphics. The safest look for an applicant tracking system." },
];
