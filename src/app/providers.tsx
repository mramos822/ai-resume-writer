"use client";

import React from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/authContext";
import { ThemeProvider as AppThemeProvider } from "@/context/themeContext";
import CookieNotice from "@/components/cookieNotice";

// Everything that needs the browser, so the root layout itself can stay a server component (and own the page metadata).
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <Toaster position="bottom-right" richColors closeButton />
        {children}
        <CookieNotice />
      </AppThemeProvider>
    </AuthProvider>
  );
}
