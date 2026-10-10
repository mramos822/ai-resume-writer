"use client";

import React, { ReactNode, useState, useEffect, createContext, useContext } from "react";
import { Bricolage_Grotesque, Figtree, Fraunces } from "next/font/google";
import TopBanner from "@/components/topBanner";
import SidePanel from "@/components/sidePanel";
import GuidedTour from "@/components/guidedTour";
import Onboarding from "@/components/onboarding";
import { ToastProvider } from "@/context/toastContext";
import { DialogProvider } from "@/context/dialogContext";
import { ProfileProvider } from "@/context/profileContext";
import { useAuth } from "@/context/authContext";
import { useRouter, usePathname } from "next/navigation";
import { PAGE_TITLES } from "@/lib/pageTitles";

const appDisplay = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-app-display" });
const appBody = Figtree({ subsets: ["latin"], variable: "--font-app-body" });
const appSerif = Fraunces({ subsets: ["latin"], variable: "--font-app-serif", axes: ["opsz"] });

export const SidePanelContext = createContext<{ isSidePanelOpen: boolean }>({ isSidePanelOpen: true });

export function useSidePanel() {
  return useContext(SidePanelContext);
}

export default function HomeLayout({ children }: { children: ReactNode }) {
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  // guests (no account yet) only get the resume builder: the dashboard is for people with an account
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // the browser tab and screen readers get the name of the page
  useEffect(() => {
    document.title = `${PAGE_TITLES[pathname] ?? "Kaizo"} | Kaizo`;
  }, [pathname]);
  const isGuest = Boolean(user?.uid.startsWith("guest-"));
  useEffect(() => {
    if (isGuest) router.replace("/build");
  }, [isGuest, router]);

  // Start collapsed on small screens so the menu doesn't cover the page
  useEffect(() => {
    if (window.innerWidth < 1024) setIsSidePanelOpen(false);
  }, []);

  // Apply the app fonts to <body> too, so dialogs and menus (rendered in portals) match
  useEffect(() => {
    const classes = [appDisplay.variable, appBody.variable, appSerif.variable, appBody.className];
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, []);

  // Safety net: a menu or dialog that closes badly can leave the body with pointer-events: none, and every click seems
  // frozen. When nothing modal is open, give the clicks back.
  useEffect(() => {
    const free = () => {
      if (document.body.style.pointerEvents === "none" && !document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]')) {
        document.body.style.pointerEvents = "";
      }
    };
    const obs = new MutationObserver(() => window.setTimeout(free, 120));
    obs.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    const interval = window.setInterval(free, 1500);
    return () => {
      obs.disconnect();
      window.clearInterval(interval);
    };
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
                <main id="main" tabIndex={-1} className="flex-1 p-4 outline-none sm:px-5 sm:py-5 lg:px-6 lg:py-6">{children}</main>
              </div>
            </div>
            <Onboarding />
            <GuidedTour />
          </SidePanelContext.Provider>
        </ProfileProvider>
      </DialogProvider>
    </ToastProvider>
  );
}
