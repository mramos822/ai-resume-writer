// The page filter, as a recruiter or an ATS applies it. A recruiter gives a resume a few seconds, so it has to:
//  - fit on ONE page (two pages are only for people with ten or more years, and Kaizo makes one-page resumes),
//  - keep the text at a size that is easy to read: below about 85% of the normal size it is small print and gets skipped,
//  - leave white space: a resume that has to shrink a lot to fit is a wall of text.
// Everything that decides if a resume "passes the page" reads these numbers, so the review, the live meter and the creation agree.

/** The smallest the text may be (as a part of its normal size) for the resume to pass. */
export const PAGE_MIN_SCALE = 0.85;
/** From this size up the resume is comfortable; between the two it passes but is tight. */
export const PAGE_COMFORT_SCALE = 0.9;

export interface PageMeasure {
  pages: number;
  scale: number;
}

/** True when the resume passes the page filter. */
export const passesPage = (fit: PageMeasure | null | undefined): boolean => !fit || (fit.pages <= 1 && fit.scale >= PAGE_MIN_SCALE);
/** True when it passes but only just. */
export const isTightPage = (fit: PageMeasure | null | undefined): boolean => !!fit && passesPage(fit) && fit.scale < PAGE_COMFORT_SCALE;
