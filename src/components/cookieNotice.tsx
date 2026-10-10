"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { COOKIE_NOTICE_KEY, PUBLIC_PATHS } from "@/lib/legal";

/** A short notice on the public side of the site. Kaizo stores only what it needs, so there is nothing to switch off. */
export default function CookieNotice() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(!localStorage.getItem(COOKIE_NOTICE_KEY));
    } catch {
      setShow(true);
    }
  }, []);

  if (!show || !PUBLIC_PATHS.includes(pathname)) return null;

  const close = () => {
    try {
      localStorage.setItem(COOKIE_NOTICE_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    setShow(false);
  };

  return (
    <div role="region" aria-label="Cookie notice" className="public-site fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-2xl sm:left-4 sm:right-auto sm:mx-0" style={{ colorScheme: "light" }}>
      <div className="flex gap-3">
        <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="text-sm leading-relaxed">
          <p className="font-semibold">We only store what Kaizo needs</p>
          <p className="mt-1 text-gray-600">Your sign-in, your theme and your unfinished resume. No ads, no tracking. Details in the <Link href="/cookies" className="font-medium text-blue-600 underline">cookie policy</Link> and <Link href="/privacy" className="font-medium text-blue-600 underline">privacy policy</Link>.</p>
          <button onClick={close} className="mt-3 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
