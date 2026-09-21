"use client";

import React, { ReactNode, useState, useEffect, createContext, useContext } from "react";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import TopBanner from "@/components/topBanner";
import SidePanel from "@/components/sidePanel";
import GuidedTour from "@/components/guidedTour";
import { ToastProvider } from "@/context/toastContext";
import { DialogProvider } from "@/context/dialogContext";
import { ProfileProvider } from "@/context/profileContext";

const appDisplay = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-app-display" });
const appBody = Figtree({ subsets: ["latin"], variable: "--font-app-body" });

export const SidePanelContext = createContext<{ isSidePanelOpen: boolean }>({ isSidePanelOpen: true });

export function useSidePanel() {
  return useContext(SidePanelContext);
}

export default function HomeLayout({ children }: { children: ReactNode }) {
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);

  // Start collapsed on small screens so the menu doesn't cover the page
  useEffect(() => {
    if (window.innerWidth < 1024) setIsSidePanelOpen(false);
  }, []);

  // Apply the app fonts to <body> too, so dialogs and menus (rendered in portals) match
  useEffect(() => {
    const classes = [appDisplay.variable, appBody.variable, appBody.className];
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, []);

  const toggleSidePanel = () => setIsSidePanelOpen((prev) => !prev);

  return (
    <ToastProvider>
      <DialogProvider>
        <ProfileProvider>
          <SidePanelContext.Provider value={{ isSidePanelOpen }}>
            <div className="app-shell flex min-h-screen bg-background text-foreground">
              <SidePanel isSidePanelOpen={isSidePanelOpen} onClose={() => setIsSidePanelOpen(false)} />

              <div className="flex min-w-0 flex-1 flex-col">
                <TopBanner toggleSidePanel={toggleSidePanel} />
                <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
              </div>
            </div>
            <GuidedTour />
          </SidePanelContext.Provider>
        </ProfileProvider>
      </DialogProvider>
    </ToastProvider>
  );
}
