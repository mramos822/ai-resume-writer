import type { Metadata } from "next";
import Link from "next/link";
import LegalLayout, { type LegalSection } from "@/components/legalLayout";

export const metadata: Metadata = { title: "Privacy Policy | Kaizo" };

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <p>Kaizo Resume Builder (&ldquo;Kaizo&rdquo;, &ldquo;we&rdquo;) is the service that decides how and why your personal data is used, as described here. You can reach us through the <Link href="/contact">contact form</Link>.</p>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p>We only collect what the service needs:</p>
        <ul>
          <li><strong>Account data:</strong> your name and email, and a password (handled by our sign-in provider, we never see it). Guest sessions get a random identifier and no name or email.</li>
          <li><strong>Resume data you give us:</strong> everything you type or import into your profile: contact details, address, photo, work history, education, skills, projects, languages and links.</li>
          <li><strong>Files:</strong> resumes you upload and the PDF or DOCX files we generate for you.</li>
          <li><strong>Job activity:</strong> job descriptions you paste, jobs you save, and the applications you prepare, including the tailored resume and cover letter.</li>
          <li><strong>Messages</strong> you send through our contact form.</li>
          <li><strong>Settings and progress</strong> such as your light or dark theme and your unfinished builder draft.</li>
          <li><strong>Basic technical data</strong> your browser sends to any website (such as IP address and browser type), which our hosting and security tools process to deliver the site and keep it safe.</li>
        </ul>
        <p>We do not use advertising trackers, analytics or session-replay tools, and we do not build advertising profiles.</p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>to build, store and show you your resumes and cover letters;</li>
        <li>to read an uploaded resume and fill in your profile;</li>
        <li>to review your resume, suggest wording and tailor it to a job (with AI);</li>
        <li>to search job listings and estimate how well they match you;</li>
        <li>to sign you in, keep your account secure and prevent abuse;</li>
        <li>to answer your messages;</li>
        <li>to meet our legal obligations.</li>
      </ul>
    ),
  },
  {
    id: "ai",
    title: "AI processing",
    body: (
      <>
        <p>When you use an AI feature, the text needed for that task (for example your resume content and, if you chose one, a job description) is sent to a third-party AI provider, Google&apos;s Gemini API by default, which returns the result to us. We send only what the task needs, and we do not use your content to train our own models.</p>
        <p>The provider processes that text under its own terms. Please do not put information in your resume that you would not want processed this way.</p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who else receives data",
    body: (
      <>
        <p>We do not sell your personal data and we do not share it for advertising. We use these providers to run the service:</p>
        <ul>
          <li><strong>Google Firebase</strong>: sign-in and some account settings.</li>
          <li><strong>MongoDB Atlas</strong>: the database where your profile, files and applications are stored.</li>
          <li><strong>Google Gemini API</strong> (or the AI provider configured for the service): AI features, as described above.</li>
          <li><strong>Adzuna, Remotive and Arbeitnow</strong>: job listings. Our servers send them the search terms and location you choose, never your resume or profile.</li>
          <li><strong>Google</strong> (favicon service): to show a company logo, your browser requests a small icon from Google using the company&apos;s website address. Google receives your IP address as with any image request.</li>
          <li><strong>Our hosting provider</strong>, which delivers the site.</li>
        </ul>
        <p>We may also disclose data when the law requires it, or to protect the rights, safety and security of Kaizo and its users.</p>
      </>
    ),
  },
  {
    id: "legal-basis",
    title: "Why we may use your data",
    body: <p>Where laws such as the GDPR apply, we rely on: <strong>performing our contract</strong> with you (providing the resume builder you asked for), <strong>our legitimate interests</strong> (keeping the service secure and working), <strong>your consent</strong> where we ask for it, and <strong>legal obligations</strong>.</p>,
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <>
        <p>We keep your data while your account exists. When you delete a resume or a profile in the app, it is removed from our database, and when you delete your account everything is removed. Guest data that is not claimed with an account may be deleted after a period of inactivity. Contact messages are kept for as long as needed to answer you and keep a record of the conversation. Backups may hold deleted data for a short time before they are overwritten.</p>
      </>
    ),
  },
  {
    id: "choices",
    title: "Your rights and choices",
    body: (
      <>
        <p>Depending on where you live (for example in the EU, the UK or California) you may have the right to access, correct, delete or get a copy of your data, to object to or limit some uses, and to withdraw consent. You also have the right not to be discriminated against for using these rights. We do not sell or share your personal data for advertising, so there is nothing to opt out of.</p>
        <ul>
          <li><strong>Edit</strong> your information anytime in your profile.</li>
          <li><strong>Download</strong> any resume as PDF or DOCX from the Resumes page.</li>
          <li><strong>Delete</strong> resumes and whole profiles from inside the app.</li>
          <li><strong>Download a copy of your data</strong> and <strong>delete your account</strong> yourself from Settings, any time. Deleting removes your profiles, resumes, applications, saved jobs and sign-in account for good (backups are overwritten within a short time).</li>
          <li><strong>Any other right</strong> (for example to correct, limit or object to a use) by writing to us through the <Link href="/contact">contact form</Link>. We will answer within the time the law sets (45 days under the NJDPA, 30 days in most other places).</li>
          <li><strong>Cookies and local storage:</strong> see the <Link href="/cookies">Cookie Policy</Link>.</li>
        </ul>
        <p>If you think we handled your data wrongly, you can complain to your local data-protection authority.</p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children (COPPA and similar laws)",
    body: (
      <>
        <p>Kaizo is for people aged <strong>16 and over</strong>. It is a tool for people who are looking for work, and it is not directed to children. In particular, we do not knowingly collect, use or share personal information from children <strong>under 13</strong>, which the United States&apos; COPPA law (and similar laws elsewhere) would require us to get a parent&apos;s consent for. We also do not knowingly collect data from anyone under 16, which is the age of digital consent in several European countries.</p>
        <p>People confirm their age when they create an account. We do not use advertising, so no child is profiled or shown ads. If we find out that we have personal information from someone under 16, we delete it and close the account. <strong>Parents or guardians</strong> who think their child has given us information can <Link href="/contact">contact us</Link> to see it, delete it or stop us from using it.</p>
      </>
    ),
  },
  {
    id: "payments",
    title: "Payments (when paid plans arrive)",
    body: (
      <p>Kaizo does not charge for anything yet and does not collect payment details. When paid plans are introduced, payments will be processed by a payment provider that receives the details needed to charge you; we will receive only a confirmation, the plan you chose and the last digits of your card, not the full card number. We will add that provider to this policy before it is used, and we will keep billing records for as long as tax and accounting laws require.</p>
    ),
  },
  {
    id: "regions",
    title: "Rights by region and privacy signals",
    body: (
      <>
        <p>Kaizo operates under the laws of the State of New Jersey, including the <strong>New Jersey Data Privacy Act</strong> (NJDPA) and New Jersey&apos;s consumer-fraud and data-breach notification laws. We apply the same protections to everyone, and we also honour the rights that apply where you live: in the European Economic Area and the United Kingdom (GDPR), California and other US states (such as the CCPA/CPRA), Brazil (LGPD), Canada, Australia and other places with a data-protection law. Under the NJDPA you can confirm whether we process your data and access it, correct it, delete it, get a portable copy, and opt out of targeted advertising, sale of data and profiling; we do none of those things. You can use them in the app (Settings has <strong>Download my data</strong> and <strong>Delete my account</strong>) or through the <Link href="/contact">contact form</Link>; we may ask you to prove who you are before we hand over data. If we refuse a request you can appeal by writing to us again with the word &ldquo;appeal&rdquo;, and if you are still not satisfied you can contact the New Jersey Division of Consumer Affairs or your own data-protection authority.</p>
        <p>We do not sell personal data, we do not share it for cross-context advertising and we do not track you across sites, so a &ldquo;Do Not Track&rdquo; or Global Privacy Control signal does not change anything: we already treat every visitor as having opted out. We do not make decisions that have legal effects on you using only automated processing.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: <p>We protect your data with encrypted connections, access controls that tie every resume and profile to its owner, and limited access to our systems. No service is perfectly secure. If a breach affects your data we will tell you and the authorities as the law requires.</p>,
  },
  {
    id: "transfers",
    title: "International transfers",
    body: <p>Our providers can process data in other countries, including the United States. When data leaves your region we rely on the safeguards the law recognises, such as standard contractual clauses, where they apply.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>If we change how we use data we will update this page and the date at the top, and tell you in the app or by email when the change is important.</p>,
  },
];

export default function PrivacyPage() {
  return <LegalLayout title="Privacy Policy" intro="What information Kaizo collects, why, who helps us handle it and the control you have over it. No tracking, no ads, no selling your data." sections={sections} />;
}
