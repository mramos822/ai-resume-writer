"use client";

// The guest resume builder: just the step-by-step builder, completely separate from the dashboard interface.
// People without an account land here from "Create my resume" (see app/start).
import React, { ReactNode, useEffect } from "react";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { ToastProvider } from "@/context/toastContext";
import { DialogProvider } from "@/context/dialogContext";
import { ProfileProvider } from "@/context/profileContext";

const appDisplay = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-app-display" });
const appBody = Figtree({ subsets: ["latin"], variable: "--font-app-body" });

export default function BuildLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const classes = [appDisplay.variable, appBody.variable, appBody.className];
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, []);

  return (
    <ToastProvider>
      <DialogProvider>
        <ProfileProvider>
          <div className="app-shell min-h-screen bg-background text-foreground">{children}</div>
        </ProfileProvider>
      </DialogProvider>
    </ToastProvider>
  );
}
