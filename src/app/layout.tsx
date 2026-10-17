import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/globals.css";
import Providers from "@/app/providers";
import { getLocale } from "@/i18n/server";
import { makeT } from "@/i18n/translate";
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { tr } = makeT(await getLocale());
  const description = tr("Build a resume that passes applicant tracking systems, tailor it to each job and download it as PDF or DOCX. Free to start.");
  return {
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: "/" },
    title: { default: tr("Kaizo Resume Builder"), template: "%s | Kaizo" },
    description,
    applicationName: "Kaizo",
    keywords: ["resume builder", "ATS resume", "cover letter", "job search", "CV", "curriculum", "currículum"],
    manifest: "/manifest.json",
    icons: { icon: "/logo-v2.png", apple: "/logo-v2.png" },
    openGraph: { title: tr("Kaizo Resume Builder"), description, images: ["/logo-v2.png"], type: "website", siteName: "Kaizo", url: "/" },
    twitter: { card: "summary", title: tr("Kaizo Resume Builder"), description, images: ["/logo-v2.png"] },
  };
}

export const viewport: Viewport = { themeColor: "#ffffff" };

// Runs before the first paint: puts the saved theme on the page so the loading screen and the first frame are never in the wrong mode.
const THEME_BOOT = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||((t===null||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const { tr } = makeT(locale);
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
          {tr("Skip to content")}
        </a>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
