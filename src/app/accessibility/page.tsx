import type { Metadata } from "next";
import Link from "@/i18n/navigation";
import LegalLayout, { type LegalSection } from "@/components/legalLayout";
import { getT } from "@/i18n/server";
import { accessibilityEs } from "@/app/accessibility/content.es";

export async function generateMetadata(): Promise<Metadata> {
  const { tr } = await getT();
  return { title: { absolute: tr("Accessibility | Kaizo") } };
}

const sections: LegalSection[] = [
  {
    id: "goal",
    title: "Our goal",
    body: <p>Kaizo should be usable by as many people as possible, including people who use a keyboard, a screen reader, zoom or a phone. We aim to follow the Web Content Accessibility Guidelines (WCAG) 2.2, level AA, in the public pages and in the resume builder.</p>,
  },
  {
    id: "done",
    title: "What we have done",
    body: (
      <ul>
        <li>A &ldquo;Skip to content&rdquo; link at the top of every page, and one main area and one main heading per page.</li>
        <li>Everything can be used with the keyboard, with a visible focus outline.</li>
        <li>Form fields have labels, and mistakes are shown next to the field and announced to screen readers.</li>
        <li>Buttons and links are at least 24 by 24 pixels, and no text is smaller than 11 pixels.</li>
        <li>The pages work on a phone and when the text is enlarged, with no sideways scrolling.</li>
        <li>Animations that appear when you scroll are turned off if your device asks for reduced motion.</li>
        <li>Light and dark themes, and the site in English and Spanish.</li>
      </ul>
    ),
  },
  {
    id: "limits",
    title: "What is not perfect yet",
    body: (
      <ul>
        <li>We have checked the site ourselves and with automatic tools. It has <strong>not</strong> had an audit by an outside accessibility expert.</li>
        <li>The resume preview is an image of the page as it will print. The PDF and DOCX files we create are laid out for looking good and for applicant tracking systems; we cannot promise they are fully tagged for screen readers.</li>
        <li>Some text, such as job descriptions, comes from other websites or from you, and we cannot control how it is written.</li>
      </ul>
    ),
  },
  {
    id: "feedback",
    title: "Tell us about a problem",
    body: <p>If something does not work for you, tell us through the <Link href="/contact">contact form</Link>: what you were trying to do, the page, and the device or assistive tool you use. A person reads every message, and we will try to fix it or offer you another way to do the same thing.</p>,
  },
];

export default async function AccessibilityPage() {
  const { tr, locale } = await getT();
  return <LegalLayout title={tr("Accessibility")} intro={tr("Kaizo is built to be used with a keyboard, a screen reader, zoom or a phone. Here is what we have done and what is still missing.")} sections={locale === "es" ? accessibilityEs : sections} />;
}
