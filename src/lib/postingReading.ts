// How to read a job posting so a resume speaks to it. One text, used by every AI prompt that writes, fixes or judges
// the resume of a job (prepare route, structured fixes, evaluation), so all of them follow the same advice.

export const POSTING_READING = `HOW TO READ THE POSTING (read all of it, not only the requirements list, and let each part shape the resume):
- The opening paragraph says why they are hiring: the problem they want solved. The career objective and the first bullet of each job should speak to that problem, with real experience that fits it.
- The responsibilities show the day-to-day work: the person's real, similar work comes first in the bullets.
- The tools and technologies show the team's stack: the ones the person really has go first in the skills, with the posting's exact names.
- The ideal-candidate or "what we value" section shows what the company cares about (ownership, speed, collaboration, rigor...): reflect it only through real facts, never as empty adjectives.
- The reporting line and the team tell who the person would work with: let the kind of collaboration in the bullets match it when the resume supports it.
- Never just copy a skills list from the posting into the resume: show what the company needs through the person's real experience.
- Write for this TYPE of role: the top of the page (job title, career objective, first bullets, first skills) must show what matters for that role, so a recruiter does not have to dig through unrelated experience. Unrelated experience stays, but shorter and lower.`;

// The same idea when there is no posting, only a target role (the general review of a resume).
export const ROLE_READING = `WRITE FOR THE TYPE OF ROLE: the top of the page (job title, career objective, first bullets, first skills) must show what matters for the target role, using the role profile's keywords and priorities only where they are TRUE for the person, so a recruiter does not have to dig through unrelated experience. Unrelated experience stays, but shorter and lower. Never copy a skills list into the resume: show the need through real experience, with the exact standard names of the tools the person has.`;
