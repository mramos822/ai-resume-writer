"use client";

import { useEffect } from "react";
import { useT } from "@/i18n/provider";

/** What a person sees when a page breaks while it runs: no stack trace, a way to try again, and a way out. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { tr } = useT();
  useEffect(() => {
    console.error("Page error", error.digest ?? "", error.message);
  }, [error]);
  return (
    <main id="main" tabIndex={-1} role="alert" className="public-site flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center text-gray-900 outline-none" style={{ colorScheme: "light" }}>
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-600">{tr("Something went wrong")}</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{tr("This page didn't load")}</h1>
      <p className="mt-4 max-w-md text-lg text-gray-600">{tr("It is not you, and nothing you made was lost. Try again, and if it keeps happening, tell us.")}</p>
      {error.digest && <p className="mt-2 text-xs text-gray-500">{tr("Reference:")} {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">{tr("Try again")}</button>
        <a href="/contact" className="rounded-md border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">{tr("Tell us")}</a>
      </div>
    </main>
  );
}
