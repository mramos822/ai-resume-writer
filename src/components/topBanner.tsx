"use client";

import LanguageSwitch from "@/components/languageSwitch";
import Link from "@/i18n/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { signOut } from "firebase/auth";
import {
    Menu,
    HelpCircle,
    Plus,
    Settings,
    LogOut,
    PlayCircle,
    LifeBuoy,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/authContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { openTour } from "@/components/guidedTour";
import ThemeToggle from "@/components/themeSwitch";
import { PAGE_TITLES } from "@/lib/pageTitles";
import { useT } from "@/i18n/provider";

interface TopBannerProps {
    toggleSidePanel: () => void;
}

export default function TopBanner({ toggleSidePanel }: TopBannerProps) {
  const { tr } = useT();
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useAuth();

    const name = user?.displayName || user?.email?.split("@")[0] || "";
    const initials = name
        .split(/[\s._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("");

    const pageTitle = tr(PAGE_TITLES[pathname] ?? "Kaizo");

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push("/");
        } catch (error) {
            console.error("Failed to log out:", error);
        }
    };

    return (
        <header className="sticky top-0 z-20 shrink-0 border-b bg-background/80 px-3 backdrop-blur-xl sm:px-6">
          <div className="flex h-16 items-center gap-3">
            <button
                onClick={toggleSidePanel}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={tr("Toggle menu")}
            >
                <Menu className="h-5 w-5" />
            </button>

            {/* where you are: a blue mark and the page */}
            <div className="flex min-w-0 items-baseline gap-2">
                <span aria-hidden className="hidden text-sm font-semibold text-muted-foreground sm:inline">Kaizo</span>
                <span aria-hidden className="hidden text-muted-foreground/50 sm:inline">/</span>
                <span className="truncate text-lg font-extrabold tracking-tight">{pageTitle}</span>
            </div>

            {/* a spot in the middle that a page can fill (the resume builder puts its buttons here) */}
            <div id="topbar-center" className="flex min-w-0 flex-1 items-center justify-center px-2" />

            <div className="ml-auto flex items-center gap-1">
                <Link
                    href="/home/resumes/new"
                    className={`${pathname === "/home/resumes/new" || pathname === "/home/resumes" ? "hidden" : "hidden sm:inline-flex"} mr-2 h-9 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-sm font-bold text-white transition-colors hover:bg-blue-700`}
                >
                    <Plus className="h-4 w-4" />{" "}{tr("New resume")}</Link>

                <LanguageSwitch tone="app" className="hidden md:inline-flex" />
                <LanguageSwitch tone="app" compact className="md:hidden" />
                <ThemeToggle compact />

                {/* Help menu */}
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            aria-label={tr("Help")}
                        >
                            <HelpCircle className="h-[18px] w-[18px]" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuLabel>{tr("Need a hand?")}</DropdownMenuLabel>
                        <DropdownMenuItem onClick={openTour} className="gap-2">
                            <PlayCircle className="h-4 w-4" />{" "}{tr("Take the 1-minute tour")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push("/home/help")} className="gap-2">
                            <LifeBuoy className="h-4 w-4" />{" "}{tr("Help center and guides")}</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <span aria-hidden className="mx-1 hidden h-6 w-px bg-border sm:block" />

                {/* Account menu */}
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={tr("Account menu")}
                        >
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-blue-600 text-xs font-bold text-white">
                                    {initials || "?"}
                                </AvatarFallback>
                            </Avatar>
                            <span className="hidden max-w-24 truncate text-sm font-semibold lg:block">{name.split(" ")[0]}</span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuLabel className="font-normal">
                            <p className="truncate text-sm font-semibold">{name || tr("Your account")}</p>
                            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push("/home/settings")} className="gap-2">
                            <Settings className="h-4 w-4" />{" "}{tr("Settings")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={handleLogout} className="gap-2">
                            <LogOut className="h-4 w-4" />{" "}{tr("Log out")}</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </div>
        </header>
    );
}
