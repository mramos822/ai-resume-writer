"use client";

import React, { useEffect } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/authContext";
import { ThemeProvider as AppThemeProvider } from "@/context/themeContext";
import CookieNotice from "@/components/cookieNotice";
import { LocaleProvider } from "@/i18n/provider";
import type { Locale } from "@/i18n/config";

// Everything that needs the browser, so the root layout itself can stay a server component (and own the page metadata).
export default function Providers({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  // While developing, no service worker may serve old files: one left over from a production build on this address would keep showing
  // the old version of the page (and its caches) however many times it is saved. In production it is left alone.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((list) => {
      for (const r of list) void r.unregister();
      if (list.length > 0 && "caches" in window) caches.keys().then((keys) => keys.forEach((k) => void caches.delete(k)));
    }).catch(() => {});
  }, []);
  return (
    <LocaleProvider locale={locale}>
      <AuthProvider>
        <AppThemeProvider>
          <Toaster position="bottom-right" richColors closeButton />
          {children}
          <CookieNotice />
        </AppThemeProvider>
      </AuthProvider>
    </LocaleProvider>
  );
}
