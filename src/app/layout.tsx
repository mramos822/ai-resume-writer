import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/globals.css";
import Providers from "@/app/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "Build a resume that passes applicant tracking systems, tailor it to each job and download it as PDF or DOCX. Free to start.";

export const metadata: Metadata = {
  title: { default: "Kaizo Resume Builder", template: "%s | Kaizo" },
  description,
  applicationName: "Kaizo",
  keywords: ["resume builder", "ATS resume", "cover letter", "job search", "CV"],
  manifest: "/manifest.json",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  openGraph: { title: "Kaizo Resume Builder", description, images: ["/logo.png"], type: "website", siteName: "Kaizo" },
  twitter: { card: "summary", title: "Kaizo Resume Builder", description, images: ["/logo.png"] },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
