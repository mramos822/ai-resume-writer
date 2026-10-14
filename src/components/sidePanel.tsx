"use client";

import { usePathname } from "@/i18n/navigation";
import Link from "@/i18n/navigation";
import KaizoLogo from "@/components/kaizoLogo";
import {
    LayoutDashboard,
    User,
    FileText,
    Briefcase,
    Settings,
    Inbox,
    Mail,
    Target,
    Wrench,
    Building2,
    GraduationCap,
    FolderKanban,
    Sprout,
    Globe,
    Languages,
    LifeBuoy,
    Check,
    X,
    type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useProfile } from "@/context/profileContext";
import { authFetch } from "@/lib/authFetch";
import { getProfileProgress } from "@/lib/profileProgress";
import { useT } from "@/i18n/provider";

interface SidePanelProps {
    isSidePanelOpen: boolean;
    onClose: () => void;
}

interface NavItem {
    href: string;
    label: string;
    icon: LucideIcon;
}

const MAIN_LINKS: NavItem[] = [
    { href: "/home", label: "Dashboard", icon: LayoutDashboard },
    { href: "/home/profile", label: "Profile", icon: User },
    { href: "/home/resumes", label: "Resumes", icon: FileText },
    { href: "/home/job-ads", label: "Job Search", icon: Briefcase },
];

const SECTION_ICONS: Record<string, LucideIcon> = {
    contact: Mail,
    objective: Target,
    skills: Wrench,
    jobs: Building2,
    education: GraduationCap,
    projects: FolderKanban,
    internships: Sprout,
    links: Globe,
    languages: Languages,
};

const linkClasses = (active: boolean) =>
    `group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
            ? "bg-blue-600 text-white shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
    }`;

/** True for the people listed in ADMIN_EMAILS (the server decides; the answer is remembered for the tab). */
function useIsAdmin(): boolean {
    const [admin, setAdmin] = useState(false);
    useEffect(() => {
        let off = false;
        try {
            const known = sessionStorage.getItem("kaizo_admin");
            if (known !== null) {
                setAdmin(known === "1");
                return;
            }
        } catch {
            /* storage unavailable */
        }
        authFetch("/api/admin/messages?check=1")
            .then((r) => {
                const yes = r.ok;
                try {
                    sessionStorage.setItem("kaizo_admin", yes ? "1" : "0");
                } catch {
                    /* storage unavailable */
                }
                if (!off) setAdmin(yes);
            })
            .catch(() => {});
        return () => {
            off = true;
        };
    }, []);
    return admin;
}

export default function SidePanel({ isSidePanelOpen, onClose }: SidePanelProps) {
  const { tr } = useT();
    const pathname = usePathname();
    const onProfilePage = pathname === "/home/profile";
    const { activeProfile } = useProfile();
    const isAdmin = useIsAdmin();
    const progress = getProfileProgress(activeProfile, tr);
    // the optional sections come after the main ones; they do not count in the profile strength
    const extraSections = [
        { key: "projects", label: "Projects", done: (activeProfile.projects?.length ?? 0) > 0 },
        { key: "internships", label: "Internships", done: (activeProfile.internships?.length ?? 0) > 0 },
        { key: "links", label: "Links", done: (activeProfile.links?.length ?? 0) + (activeProfile.certifications?.length ?? 0) > 0 },
        { key: "languages", label: "Languages", done: (activeProfile.languages?.length ?? 0) > 0 },
    ];

    return (
        <>
            {/* Mobile backdrop */}
            <div
                onClick={onClose}
                className={`fixed inset-0 z-30 bg-black/40 transition-opacity lg:hidden ${
                    isSidePanelOpen ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
            />

            <aside
                className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto border-r bg-sidebar transition-transform duration-300 lg:sticky lg:left-auto lg:top-0 lg:z-auto lg:h-screen lg:shrink-0 lg:self-start lg:transition-[margin] ${
                    isSidePanelOpen ? "translate-x-0" : "-translate-x-full lg:-ml-64 lg:translate-x-0"
                }`}
            >
                <div className="flex h-16 shrink-0 items-center justify-between border-b px-5">
                    <Link href="/home" className="flex items-center">
                        <KaizoLogo width={104} />
                    </Link>
                    <button
                        onClick={onClose}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
                        aria-label={tr("Close menu")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <nav className="flex flex-1 flex-col gap-6 p-4">
                    <ul className="flex flex-col gap-1">
                        {MAIN_LINKS.map(({ href, label, icon: Icon }) => (
                            <li key={href}>
                                <Link
                                    href={href}
                                    onClick={() => window.innerWidth < 1024 && onClose()}
                                    className={linkClasses(pathname === href)}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    {tr(label)}
                                </Link>
                            </li>
                        ))}
                    </ul>

                    <div>
                        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr("Profile sections")}</p>
                        <ul className="flex flex-col gap-1">
                            {[...progress.sections, ...extraSections].map(({ key, label, done }) => {
                                const Icon = SECTION_ICONS[key];
                                const cls = linkClasses(false);
                                const inner = (
                                    <>
                                        <Icon className="h-4 w-4 shrink-0" />
                                        <span className="flex-1">{tr(label)}</span>
                                        <span
                                            className={`flex h-4 w-4 items-center justify-center rounded-full ${
                                                done
                                                    ? "bg-green-500 text-white"
                                                    : "border border-border text-transparent"
                                            }`}
                                            title={done ? tr("Complete") : tr("Still to do")}
                                        >
                                            <Check className="h-3 w-3" strokeWidth={3} />
                                        </span>
                                    </>
                                );
                                return (
                                    <li key={key}>
                                        {onProfilePage ? (
                                            <a href={`#${key}`} className={cls}>
                                                {inner}
                                            </a>
                                        ) : (
                                            <Link href={`/home/profile#${key}`} className={cls}>
                                                {inner}
                                            </Link>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* Profile strength */}
                    <div className="mt-auto rounded-md border bg-accent/50 p-3">
                        <div className="mb-2 flex items-center justify-between text-xs">
                            <span className="font-semibold">{tr("Profile strength")}</span>
                            <span className="font-bold text-blue-600">{progress.percent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-border">
                            <div
                                className="progress-fill h-full rounded-full bg-blue-600 transition-[width] duration-700"
                                style={{ width: `${progress.percent}%` }}
                            />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            {progress.percent === 100
                                ? tr("All set! Your profile is complete.")
                                : tr("Next: {label}", { label: progress.next?.label })}
                        </p>
                    </div>

                    <div className="flex flex-col gap-1 border-t pt-4">
                        <Link href="/home/help" className={linkClasses(pathname === "/home/help")}>
                            <LifeBuoy className="h-4 w-4 shrink-0" />{tr("Help & tutorials")}</Link>
                        {isAdmin && (
                            <Link href="/home/admin/messages" className={linkClasses(pathname === "/home/admin/messages")}>
                                <Inbox className="h-4 w-4 shrink-0" />{tr("Messages")}</Link>
                        )}
                        <Link href="/home/settings" className={linkClasses(pathname === "/home/settings")}>
                            <Settings className="h-4 w-4 shrink-0" />{tr("Settings")}</Link>
                    </div>
                </nav>
            </aside>
        </>
    );
}
