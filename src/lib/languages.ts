export interface LanguageEntry {
  name: string;
  level: string;
}

/** Proficiency levels, from strongest to weakest. */
export const LANGUAGE_LEVELS = ["Native", "Fluent", "Advanced", "Intermediate", "Basic"] as const;

/** How full the level bar is, 0 to 1. */
export function levelFraction(level: string): number {
  switch (level) {
    case "Native":
    case "Fluent":
      return 1;
    case "Advanced":
      return 0.8;
    case "Intermediate":
      return 0.55;
    case "Basic":
      return 0.3;
    default:
      return 0.7;
  }
}

/** Filled dots out of five, for the Creative look. */
export function levelDots(level: string): string {
  const n = Math.max(1, Math.round(levelFraction(level) * 5));
  return "●".repeat(n) + "○".repeat(5 - n);
}

export const POPULAR_LANGUAGES = ["English", "Spanish", "French", "Mandarin Chinese", "German", "Portuguese", "Arabic", "Hindi"];

export const LANGUAGES: string[] = [
  "English", "Spanish", "French", "German", "Portuguese", "Italian", "Mandarin Chinese", "Cantonese", "Japanese", "Korean",
  "Arabic", "Hindi", "Russian", "Vietnamese", "Tagalog", "Haitian Creole", "Polish", "Ukrainian", "Turkish", "Persian (Farsi)",
  "Urdu", "Bengali", "Punjabi", "Gujarati", "Tamil", "Telugu", "Marathi", "Nepali", "Thai", "Indonesian", "Malay", "Dutch",
  "Swedish", "Norwegian", "Danish", "Finnish", "Greek", "Hebrew", "Romanian", "Hungarian", "Czech", "Slovak", "Bulgarian",
  "Serbian", "Croatian", "Albanian", "Armenian", "Georgian", "Amharic", "Swahili", "Yoruba", "Igbo", "Somali", "Hausa",
  "Zulu", "Afrikaans", "American Sign Language", "Navajo", "Hawaiian", "Latin", "Catalan", "Irish", "Welsh", "Lithuanian",
  "Latvian", "Estonian", "Burmese", "Khmer", "Lao", "Mongolian", "Kurdish", "Pashto", "Sinhala", "Portuguese (Brazilian)",
];
