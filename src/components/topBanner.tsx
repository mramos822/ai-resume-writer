"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
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

interface TopBannerProps {
    toggleSidePanel: () => void;
}

export default function TopBanner({ toggleSidePanel }: TopBannerProps) {
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

    const pageTitle = PAGE_TITLES[pathname] ?? "Kaizo";

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push("/");
        } catch (error) {
            console.error("Failed to log out:", error);
        }
    };

    return (
        <header className="sticky top-0 z-20 shrink-0 border-b bg-background/85 px-3 backdrop-blur-md sm:px-5">
          <div className="flex h-16 items-center gap-2">
            <div className="flex items-center gap-1">
                <button
                    onClick={toggleSidePanel}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Toggle menu"
                >
                    <Menu className="h-5 w-5" />
                </button>
                <nav className="flex items-center gap-2 pl-1 text-sm">
                    <span className="text-lg font-extrabold tracking-tight">{pageTitle}</span>
                </nav>
            </div>

            {/* a spot in the middle that a page can fill (the resume builder puts its buttons here) */}
            <div id="topbar-center" className="flex min-w-0 flex-1 items-center justify-center px-2" />

            <div className="ml-auto flex items-center gap-1">
                <Link
                    href="/home/resumes/new"
                    className={`${pathname === "/home/resumes/new" || pathname === "/home/resumes" ? "hidden" : "hidden sm:inline-flex"} mr-2 h-9 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-sm font-bold text-white transition-colors hover:bg-blue-700`}
                >
                    <Plus className="h-4 w-4" /> New resume
                </Link>

                <ThemeToggle compact />

                {/* Help menu */}
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            aria-label="Help"
                        >
                            <HelpCircle className="h-[18px] w-[18px]" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuLabel>Need a hand?</DropdownMenuLabel>
                        <DropdownMenuItem onClick={openTour} className="gap-2">
                            <PlayCircle className="h-4 w-4" /> Take the 1-minute tour
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push("/home/help")} className="gap-2">
                            <LifeBuoy className="h-4 w-4" /> Help center and guides
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Account menu */}
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="ml-1 rounded-full focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="Account menu"
                        >
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-blue-600 text-xs font-bold text-white">
                                    {initials || "?"}
                                </AvatarFallback>
                            </Avatar>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuLabel className="font-normal">
                            <p className="truncate text-sm font-semibold">{name || "Your account"}</p>
                            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push("/home/settings")} className="gap-2">
                            <Settings className="h-4 w-4" /> Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleLogout} className="gap-2">
                            <LogOut className="h-4 w-4" /> Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </div>
        </header>
    );
}
