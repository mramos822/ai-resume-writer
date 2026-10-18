import { EN, type Tr } from "@/i18n/translate";

// Starter bullets, picked from the job title the person typed. They are examples to edit, never filled in automatically.
const BANK: { match: RegExp; ideas: string[] }[] = [
  {
    match: /software|developer|programmer|engineer|devops|web|frontend|backend|full ?stack|qa|tester/i,
    ideas: [
      "Built and shipped features used by 1,000+ users",
      "Fixed bugs and improved performance, cutting load time by 30%",
      "Wrote unit tests that raised coverage to 85%",
      "Collaborated with designers and teammates in 2-week sprints",
      "Reviewed code and documented decisions for the team",
    ],
  },
  {
    match: /data|analyst|scientist|machine learning|\bai\b|statistic/i,
    ideas: [
      "Cleaned and analyzed datasets of 100k+ rows to find trends",
      "Built dashboards that the team used every week",
      "Presented findings to non-technical stakeholders",
      "Automated a weekly report, saving 5 hours of manual work",
    ],
  },
  {
    match: /barista|server|waiter|waitress|cook|chef|bartender|host|restaurant|kitchen|cafe|food/i,
    ideas: [
      "Served 100+ customers per shift in a fast-paced environment",
      "Prepared orders accurately and followed food safety rules",
      "Handled cash and card payments with a balanced drawer",
      "Trained 3 new team members on menu and procedures",
      "Kept the work area clean and stocked during rush hours",
    ],
  },
  {
    match: /cashier|retail|store|stock|merchandis|associate|clerk/i,
    ideas: [
      "Processed 80+ transactions per shift with no cash errors",
      "Helped customers find products and recommended add-ons",
      "Restocked shelves and kept displays neat and on-brand",
      "Handled returns and resolved complaints politely",
      "Opened and closed the store following checklists",
    ],
  },
  {
    match: /nurse|medical|patient|health|pharmac|dental|caregiver|aide|clinic|hospital/i,
    ideas: [
      "Cared for 12+ patients per shift, tracking vitals and charting accurately",
      "Followed infection control and HIPAA procedures",
      "Communicated updates to patients, families and the care team",
      "Helped with daily needs like mobility, meals and medication reminders",
    ],
  },
  {
    match: /teach|tutor|instructor|professor|teaching assistant|coach|counselor|school/i,
    ideas: [
      "Planned and taught lessons for a class of 25 students",
      "Raised average quiz scores by 15% through small-group practice",
      "Adapted materials for different learning needs",
      "Kept parents informed with regular progress updates",
    ],
  },
  {
    match: /admin|assistant|receptionist|office|secretary|data entry|coordinator/i,
    ideas: [
      "Managed calendars, calls and email for a team of 8",
      "Entered and checked 200+ records a day with 99% accuracy",
      "Organized files and supplies, cutting search time in half",
      "Scheduled meetings and prepared documents for leadership",
    ],
  },
  {
    match: /sales|account|business development|representative|rep\b/i,
    ideas: [
      "Reached 110% of monthly sales target for 4 months in a row",
      "Contacted 40+ leads a week and booked 10 demos",
      "Built lasting relationships with 30+ accounts",
      "Tracked deals and follow-ups in the CRM",
    ],
  },
  {
    match: /customer|support|service|call center|help ?desk/i,
    ideas: [
      "Resolved 50+ customer tickets a day with a 95% satisfaction score",
      "Stayed calm and solved issues for upset customers",
      "Documented common problems to speed up the team",
      "Escalated complex cases with clear notes",
    ],
  },
  {
    match: /market|social media|content|copy|brand|seo|communications|writer|editor/i,
    ideas: [
      "Grew the Instagram audience by 40% in 6 months",
      "Wrote posts and emails that lifted click rate by 20%",
      "Planned a monthly content calendar across 3 channels",
      "Reported results weekly and tested new ideas",
    ],
  },
  {
    match: /warehouse|driver|delivery|logistics|forklift|shipping|courier|truck/i,
    ideas: [
      "Loaded, packed and shipped 150+ orders per shift",
      "Delivered 40+ packages a day on time with zero damages",
      "Kept inventory counts accurate and organized",
      "Followed safety rules and operated equipment safely",
    ],
  },
  {
    match: /intern|volunteer|student|assistant/i,
    ideas: [
      "Supported the team with day-to-day tasks and research",
      "Completed a project on time and presented it to 10+ people",
      "Learned new tools quickly and asked for feedback",
    ],
  },
];

const GENERIC = [
  "Completed daily tasks accurately and on time",
  "Worked with a team of 5 to reach shared goals",
  "Learned new tools and processes quickly",
  "Helped 20+ customers or colleagues every week",
  "Suggested an improvement that saved time",
];

/** Example bullets for a job title (never empty). */
export function ideasFor(title: string, tr: Tr = EN): string[] {
  const t = title.trim();
  const list = !t ? GENERIC : BANK.find((b) => b.match.test(t))?.ideas ?? GENERIC;
  return list.map((i) => tr(i));
}
