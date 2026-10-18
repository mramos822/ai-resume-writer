import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/i18n/navigation";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { tr } = await getT();
  return { title: tr("Page not found"), robots: { index: false } };
}

/** The page for an address that does not exist: it says so plainly and gives the way back. */
export default async function NotFound() {
  const { tr } = await getT();
  return (
    <main id="main" tabIndex={-1} className="public-site flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center text-gray-900 outline-none" style={{ colorScheme: "light" }}>
      <Link href="/" aria-label={tr("Kaizo home")} className="mb-10">
        <Image src="/kaizologo-v2.png" unoptimized alt={tr("Kaizo Resume Builder")} width={105} height={35} priority />
      </Link>
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">404</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{tr("We can't find that page")}</h1>
      <p className="mt-4 max-w-md text-lg text-gray-600">{tr("The address may have a typo, or the page was moved. Your resumes are safe.")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">{tr("Go to the home page")}</Link>
        <Link href="/home" className="rounded-md border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">{tr("Go to my dashboard")}</Link>
      </div>
    </main>
  );
}
