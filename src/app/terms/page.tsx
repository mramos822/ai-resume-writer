import type { Metadata } from "next";
import Link from "next/link";
import LegalLayout, { type LegalSection } from "@/components/legalLayout";

export const metadata: Metadata = { title: "Terms of Service | Kaizo" };

const sections: LegalSection[] = [
  {
    id: "acceptance",
    title: "Agreeing to these terms",
    body: (
      <>
        <p>By using Kaizo Resume Builder (&ldquo;Kaizo&rdquo;, &ldquo;the service&rdquo;, &ldquo;we&rdquo;) you agree to these terms and to our <Link href="/privacy">Privacy Policy</Link>. If you do not agree, please do not use the service.</p>
        <p>You must be at least 16 years old to use Kaizo, and when you create an account you confirm that you are. Kaizo is not directed to children under 13, and we do not knowingly collect personal information from anyone under 16. If we learn that someone under 16 has given us information, we delete it and close the account. If you believe that has happened, <Link href="/contact">contact us</Link>.</p>
      </>
    ),
  },
  {
    id: "service",
    title: "What Kaizo does",
    body: (
      <>
        <p>Kaizo helps you write resumes and cover letters. You enter or import your details, choose a look, and download the result as PDF or DOCX. Optional features search public job listings, estimate how well your profile matches a job and prepare a resume and cover letter adapted to it.</p>
        <p>Kaizo prepares application material for you. It does <strong>not</strong> apply to jobs on your behalf and does not contact employers.</p>
      </>
    ),
  },
  {
    id: "plans",
    title: "Free use and paid plans",
    body: (
      <>
        <p>Today, Kaizo can be used for free. We plan to offer paid plans or paid features in the future. Nothing is charged unless you knowingly choose a paid option.</p>
        <p>When we do offer paid options, before you pay we will show you, next to the button that confirms the purchase: the price and currency, what is included, how often you are billed, <strong>whether the plan renews automatically and when</strong>, and how to cancel. We will send you a confirmation by email, and you will be able to cancel online in a few clicks, without calling anyone. Cancelling stops future charges and you keep access until the end of the period you already paid for.</p>
        <p>Where the law gives you a right to withdraw from a digital purchase or to a refund (for example, a 14-day withdrawal period for consumers in the EU and the UK, unless you ask us to start the service right away and agree to lose that right), we will honour it, and we will explain it at checkout. Payments will be handled by a payment provider; we will not store your full card number. Prices may change, but never for a period you have already paid, and we will warn you before a change affects your renewal.</p>
        <p>These terms will be updated with the details of each paid plan before it is available.</p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts and guest sessions",
    body: (
      <>
        <p>You can start building a resume without an account, as a guest. A guest session lives in the browser you used. If you clear your browser data or use another device, a guest resume may no longer be available. Create an account to keep your work.</p>
        <p>You are responsible for keeping your password safe and for what happens under your account. Give us accurate information and tell us if you think someone else is using your account.</p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <>
        <p>Everything you put into Kaizo (your profile, uploaded resumes, job descriptions and the documents we generate for you) is <strong>your content</strong>. You keep all rights to it. You give us a limited permission to store it, process it and show it back to you, only so we can run the service you asked for.</p>
        <p>Your content is private to your account. We do not publish it, and Kaizo is not a place where users share files with each other.</p>
        <p>You promise that you have the right to upload what you upload, and that your resume is truthful. Please do not include information about other people without their permission, and do not include more sensitive information than an employer needs.</p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI-written content",
    body: (
      <>
        <p>Some features use artificial intelligence to suggest wording, review your resume and write cover letters. AI can make mistakes. <strong>Read everything before you send it.</strong> You are the author of your resume and are responsible for it being accurate and for what you apply with.</p>
        <p>We do not promise that a resume will pass any particular applicant tracking system, that you will get an interview or a job, or that suggestions are right for your situation. Scores and checks in Kaizo are guidance, not a guarantee.</p>
      </>
    ),
  },
  {
    id: "jobs",
    title: "Job listings from other sources",
    body: (
      <p>Job listings come from third-party sources such as Adzuna, Remotive and Arbeitnow. We do not write, verify or endorse them, and they can be out of date or removed. Applying always happens on the employer&apos;s or the source&apos;s own site, under their terms and privacy practices.</p>
    ),
  },
  {
    id: "use",
    title: "Acceptable use",
    body: (
      <>
        <p>Please do not:</p>
        <ul>
          <li>use Kaizo to make false or misleading resumes, or to impersonate someone;</li>
          <li>upload anything illegal, harmful or that infects other systems with malware;</li>
          <li>try to break, overload, scrape or reverse-engineer the service, or get around its limits and security;</li>
          <li>access accounts or data that are not yours;</li>
          <li>use the service in ways that break the law.</li>
        </ul>
        <p>We may limit or suspend access if these rules are broken or to protect the service and other people.</p>
      </>
    ),
  },
  {
    id: "ip",
    title: "Our property",
    body: <p>The Kaizo name, logo, software, templates and design belong to us or our licensors and are protected by law. We give you a personal, non-exclusive, non-transferable right to use them through the service. The resumes you generate are yours and you can use them anywhere you like.</p>,
  },
  {
    id: "changes",
    title: "Changes, availability and ending the service",
    body: (
      <>
        <p>We keep improving Kaizo, so features can change or be removed. We work to keep the service available but cannot promise it will always be uninterrupted or error-free.</p>
        <p>You can stop using Kaizo at any time and delete your resumes and profiles from inside the app. To close your account completely, <Link href="/contact">contact us</Link>. We may suspend or end an account that breaks these terms.</p>
      </>
    ),
  },
  {
    id: "warranty",
    title: "No warranties",
    body: <p>Kaizo is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the fullest extent the law allows, we do not give warranties of any kind, express or implied, including about fitness for a particular purpose, accuracy of AI output or results of your job search.</p>,
  },
  {
    id: "liability",
    title: "Limit of liability",
    body: <p>To the fullest extent the law allows, Kaizo and the people who run it are not liable for indirect, incidental, special or consequential losses, or for lost opportunities, income or data, arising from your use of the service. Nothing in these terms limits rights you have under consumer protection laws that cannot be waived, or liability that cannot be excluded by law.</p>,
  },
  {
    id: "law",
    title: "Changes to these terms and governing law",
    body: (
      <>
        <p>We may update these terms. When the changes are important we will say so on the site, and the date at the top will change. Using Kaizo after an update means you accept it.</p>
        <p>These terms, and any dispute about them or about the service, are governed by the laws of the <strong>State of New Jersey</strong> and the federal laws of the United States that apply there, without regard to conflict-of-law rules. Any dispute that cannot be settled by talking to us first will be brought in the state or federal courts located in New Jersey, and you and we agree to their jurisdiction. This does not take away mandatory consumer protections that the law of the place where you live gives you, nor your right to bring a claim in your local courts where the law says you can.</p>
        <p>Kaizo can be used from many countries. You are responsible for following the laws that apply to you where you live, and we handle personal data according to the rules described in the <Link href="/privacy">Privacy Policy</Link>, which includes the rights people have under laws such as the GDPR, the UK GDPR, the California privacy laws and Brazil&apos;s LGPD.</p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions about these terms? Write to us through the <Link href="/contact">contact form</Link>.</p>,
  },
];

export default function TermsPage() {
  return <LegalLayout title="Terms of Service" intro="The rules for using Kaizo, in plain language. Please read them before you start." sections={sections} />;
}
