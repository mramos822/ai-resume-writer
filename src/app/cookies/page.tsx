import type { Metadata } from "next";
import Link from "@/i18n/navigation";
import LegalLayout, { type LegalSection } from "@/components/legalLayout";
import { getT } from "@/i18n/server";
import { cookiesEs } from "@/app/cookies/content.es";

export async function generateMetadata(): Promise<Metadata> {
  const { tr } = await getT();
  return { title: { absolute: tr("Cookie Policy | Kaizo") } };
}

const stored = [
  { name: "Sign-in session", where: "Browser storage (Firebase)", why: "Keeps you signed in, including guest sessions.", howLong: "Until you log out or clear site data" },
  { name: "Theme", where: "Local storage", why: "Remembers light or dark mode.", howLong: "Until you clear site data" },
  { name: "Language", where: "Cookie", why: "Remembers the language you chose (it is only saved when you choose it yourself).", howLong: "1 year" },
  { name: "Builder progress", where: "Local storage", why: "Saves your unfinished resume draft and remembers that you finished the first-time setup.", howLong: "Until you finish, start over or clear site data" },
  { name: "Look you picked", where: "Local storage", why: "Remembers the resume template and accent color you chose.", howLong: "Until you clear site data" },
  { name: "Steps in progress", where: "Session storage", why: "Carries a choice from one screen to the next (for example the profile to open or a job you are applying to). It disappears when you close the tab.", howLong: "Until you close the tab" },
  { name: "Cookie notice", where: "Local storage", why: "Remembers that you read this notice so we do not show it again.", howLong: "Until you clear site data" },
];

const sections: LegalSection[] = [
  {
    id: "what",
    title: "What cookies and local storage are",
    body: <p>Cookies are small files a website saves in your browser. Local storage and similar tools do the same job in a different place. Websites use them to remember things between visits. This page uses &ldquo;cookies&rdquo; for all of them.</p>,
  },
  {
    id: "use",
    title: "What Kaizo stores",
    body: (
      <>
        <p>Kaizo only stores what it needs to work. These are <strong>strictly necessary</strong> and do not need your consent under the rules that apply to cookies:</p>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2.5 font-semibold">What</th>
                <th className="px-4 py-2.5 font-semibold">Where</th>
                <th className="px-4 py-2.5 font-semibold">Why</th>
                <th className="px-4 py-2.5 font-semibold">How long</th>
              </tr>
            </thead>
            <tbody>
              {stored.map((r) => (
                <tr key={r.name} className="border-t border-gray-200 align-top">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-2.5">{r.where}</td>
                  <td className="px-4 py-2.5">{r.why}</td>
                  <td className="px-4 py-2.5">{r.howLong}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "not",
    title: "What we do not use",
    body: (
      <ul>
        <li>No advertising or marketing cookies and no tracking pixels.</li>
        <li>No analytics, and no session-replay or recording tools.</li>
        <li>No social-media buttons that track you.</li>
        <li>Fonts are loaded from our own site, not from an outside font service.</li>
      </ul>
    ),
  },
  {
    id: "third",
    title: "Third parties",
    body: <p>To show a company logo on a job, your browser asks Google&apos;s favicon service for a small icon. This is an image request, not a cookie we set, but Google receives your IP address as with any image. Job search and AI features run from our servers, so those providers do not set anything in your browser. See the <Link href="/privacy">Privacy Policy</Link> for the full list.</p>,
  },
  {
    id: "control",
    title: "Your control",
    body: (
      <>
        <p>You can delete what Kaizo stored at any time from your browser settings (look for &ldquo;clear site data&rdquo;). If you do, you will be signed out, and a guest resume that was not saved to an account cannot be recovered. You can also block storage altogether, but Kaizo will not work properly without it.</p>
        <p>If we ever add optional cookies, such as analytics, we will ask for your consent first, and nothing optional will load before you say yes.</p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Questions",
    body: <p>Write to us through the <Link href="/contact">contact form</Link>.</p>,
  },
];

export default async function CookiesPage() {
  const { tr, locale } = await getT();
  return <LegalLayout title={tr("Cookie Policy")} intro={tr("Kaizo only stores what it needs to work: your sign-in, your theme and your unfinished resume. Nothing for ads, nothing for tracking.")} sections={locale === "es" ? cookiesEs : sections} />;
}
