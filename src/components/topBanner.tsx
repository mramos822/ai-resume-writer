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
    ChevronRight,
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

interface TopBannerProps {
    toggleSidePanel: () => void;
}

const PAGE_TITLES: Record<string, string> = {
    "/home": "Dashboard",
    "/home/profile": "Profile",
    "/home/resumes": "Resumes",
    "/home/job-ads": "Job Ads",
    "/home/settings": "Settings",
    "/home/help": "Help & tutorials",
};

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
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b bg-card/90 px-4 backdrop-blur">
            <div className="flex items-center gap-3">
                <button
                    onClick={toggleSidePanel}
                    className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Toggle menu"
                >
                    <Menu className="h-5 w-5" />
                </button>
                <nav className="flex items-center gap-1.5 text-sm">
                    <Link href="/home" className="hidden text-muted-foreground hover:text-foreground sm:inline">
                        Kaizo
                    </Link>
                    <ChevronRight className="hidden h-4 w-4 text-muted-foreground sm:inline" />
                    <span className="font-semibold">{pageTitle}</span>
                </nav>
            </div>

            <div className="flex items-center gap-2">
                <Link
                    href="/home/job-ads"
                    className="hidden items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 sm:inline-flex"
                >
                    <Plus className="h-4 w-4" /> New resume
                </Link>

                {/* Help menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label="Help"
                        >
                            <HelpCircle className="h-5 w-5" />
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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="rounded-full ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="Account menu"
                        >
                            <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-blue-600 text-sm font-semibold text-white">
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
        </header>
    );
}
