// What each plan includes. THE one place to change a limit: the server applies these numbers (the screens only show them).
// Free: 1 saved resume, 3 AI reviews in total, the fit of any job, the job search, downloads of what was made.
// Pro (monthly): unlimited resumes, and the AI work (reviews and resumes tailored to a job) "unlimited with fair use": a high monthly
// ceiling that a normal person never reaches, so one heavy or automated account cannot cost more than it pays.

export type PlanId = "free" | "pro";

export const LIMITS = {
  free: {
    /** resumes kept at the same time (the ones made with Create resume or the step-by-step builder) */
    resumes: 1,
    /** AI reviews of a resume in the whole life of the account (not per month) */
    reviewsInTotal: 3,
    /** a resume written for one job, with its cover letter: only with the paid plan */
    tailoring: false,
  },
  pro: {
    resumes: Infinity,
    /** reviews and tailored resumes together, per calendar month (the fair use ceiling; never shown as a number) */
    aiPerMonth: 300,
    tailoring: true,
  },
} as const;

/** The reasons a request is refused for the plan: the screens open the "upgrade" window with the matching text. */
export type LimitCode = "resume_limit" | "review_limit" | "pro_required" | "fair_use";

export const LIMIT_MESSAGE: Record<LimitCode, string> = {
  resume_limit: "Your free plan keeps 1 resume. Get more space to make another one, or replace the one you have.",
  review_limit: "You used your 3 free AI reviews. Upgrade to keep improving your resume with AI.",
  pro_required: "Resumes written for a job (with their cover letter) are part of the paid plan.",
  fair_use: "You reached this month's fair use limit for AI. It renews next month; write to us if you need more.",
};

/** "2026-10": the month a usage counter belongs to. */
export const monthOf = (d: Date = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
