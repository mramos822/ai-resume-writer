"use client";

// Settings: who you are, how the app looks, your password and your data. A rail on the left jumps between the parts, each part
// says what it is for, and the save bar only appears when there is something to save.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getAuth, onAuthStateChanged, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, signOut, type User } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { Check, Download, Eye, EyeOff, KeyRound, Loader2, Monitor, Moon, Palette, ShieldAlert, Sun, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/themeContext";
import { useDialog } from "@/context/dialogContext";
import { auth as appAuth } from "@/lib/firebase";
import { authFetch } from "@/lib/authFetch";
import { getFriendlyFirebaseErrorMessage } from "@/utils/firebaseErrorHandler";

type ThemeType = "light" | "dark" | "system";

const SECTIONS = [
    { id: "account", label: "Account", icon: UserRound },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "security", label: "Password", icon: KeyRound },
    { id: "data", label: "Your data", icon: ShieldAlert },
];

const field = "h-11 w-full rounded-lg border bg-background px-3.5 text-[15px] outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-60";

/** How strong a new password is: 0 to 4. */
function strength(p: string): number {
    let n = 0;
    if (p.length >= 8) n++;
    if (p.length >= 12) n++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) n++;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) n++;
    return n;
}

/** A little drawing of the app in each theme. */
function ThemeArt({ mode }: { mode: ThemeType }) {
    const paint = (dark: boolean) => (
        <div className={`flex h-full w-full ${dark ? "bg-[#0b1220]" : "bg-[#f4f6fb]"}`}>
            <div className={`w-1/4 space-y-1.5 p-2 ${dark ? "bg-[#111a2e]" : "bg-white"}`}>
                <div className="h-1.5 w-3/4 rounded bg-blue-500" />
                {[0, 1, 2].map((i) => (
                    <div key={i} className={`h-1 rounded ${dark ? "bg-white/15" : "bg-black/10"}`} />
                ))}
            </div>
            <div className="flex-1 space-y-1.5 p-2">
                <div className={`h-1.5 w-1/2 rounded ${dark ? "bg-white/70" : "bg-black/60"}`} />
                <div className={`h-6 rounded ${dark ? "bg-[#111a2e]" : "bg-white"}`} />
                <div className="h-1.5 w-1/3 rounded bg-blue-500" />
            </div>
        </div>
    );
    if (mode === "system") {
        return (
            <div className="relative h-full w-full overflow-hidden">
                <div className="absolute inset-0">{paint(false)}</div>
                <div className="absolute inset-0" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}>{paint(true)}</div>
            </div>
        );
    }
    return paint(mode === "dark");
}

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const router = useRouter();
    const dialog = useDialog();

    const [user, setUser] = useState<User | null>(null);
    const [name, setName] = useState("");
    const [savedName, setSavedName] = useState("");
    const [savedTheme, setSavedTheme] = useState<ThemeType>(theme as ThemeType);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [show, setShow] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [active, setActive] = useState("account");
    const loaded = useRef(false);

    useEffect(() => {
        return onAuthStateChanged(getAuth(), (u) => {
            setUser(u);
            if (u && !loaded.current) {
                loaded.current = true;
                setName(u.displayName || "");
                setSavedName(u.displayName || "");
                setSavedTheme(theme as ThemeType);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // the rail follows the part of the page that is in view
    useEffect(() => {
        const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
        const obs = new IntersectionObserver(
            (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
            { rootMargin: "-20% 0px -65% 0px" }
        );
        els.forEach((e) => obs.observe(e));
        return () => obs.disconnect();
    }, []);

    const isOAuth = !!user?.providerData.some((p) => p.providerId !== "password");
    const provider = user?.providerData[0]?.providerId === "google.com" ? "Google" : isOAuth ? "a social account" : "Email and password";
    const initials = (name || user?.email || "?").split(/[\s._@-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
    const since = user?.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";

    const wantsPassword = !isOAuth && (currentPassword !== "" || newPassword !== "" || confirmPassword !== "");
    const dirty = name.trim() !== savedName.trim() || theme !== savedTheme || wantsPassword;
    const score = useMemo(() => strength(newPassword), [newPassword]);

    const discard = () => {
        setName(savedName);
        if (theme !== savedTheme) setTheme(savedTheme);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setError(null);
    };

    const save = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!user || saving) return;
        setSaving(true);
        setError(null);
        try {
            if (name.trim() !== (user.displayName || "")) await updateProfile(user, { displayName: name.trim() });
            await setDoc(doc(getFirestore(), "users", user.uid), { theme }, { merge: true });

            if (wantsPassword) {
                if (!currentPassword || !newPassword || !confirmPassword) throw new Error("To change your password, fill in all three password fields.");
                if (newPassword !== confirmPassword) throw new Error("The new password and its confirmation do not match.");
                if (newPassword.length < 8) throw new Error("Use at least 8 characters for the new password.");
                await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, currentPassword));
                await updatePassword(user, newPassword);
                toast.success("Password changed.");
            }
            setSavedName(name.trim());
            setSavedTheme(theme as ThemeType);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            toast.success("Settings saved.");
        } catch (err) {
            console.error("Error saving settings", err);
            setError(err instanceof Error && !("code" in err) ? err.message : getFriendlyFirebaseErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await authFetch("/api/account");
            if (!res.ok) throw new Error();
            const url = URL.createObjectURL(await res.blob());
            const a = document.createElement("a");
            a.href = url;
            a.download = "kaizo-my-data.json";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("We couldn't prepare your data. Please try again.");
        } finally {
            setExporting(false);
        }
    };

    const handleDeleteAccount = async () => {
        const typed = await dialog.prompt({
            title: "Delete your account?",
            description: "Your account, profiles, resumes, applications and saved jobs will be removed for good. Download your data first if you want to keep a copy.",
            label: "Type DELETE to confirm",
            placeholder: "DELETE",
            confirmText: "Delete my account",
            validate: (v) => (v.trim() === "DELETE" ? null : "Type the word DELETE in capital letters."),
        });
        if (typed?.trim() !== "DELETE") return;
        setDeleting(true);
        try {
            const res = await authFetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) });
            const data = await res.json().catch(() => ({}));
            if (res.status === 401 && data.code === "reauth") {
                toast.error("For your security, log in again and then delete your account.");
                await signOut(appAuth);
                router.push("/login?view=login");
                return;
            }
            if (!res.ok) throw new Error(data.error || "");
            await signOut(appAuth).catch(() => {});
            router.push("/");
        } catch (e) {
            toast.error((e as Error).message || "We couldn't delete your account. Please try again or contact us.");
            setDeleting(false);
        }
    };

    const THEMES: { id: ThemeType; label: string; hint: string; icon: typeof Sun }[] = [
        { id: "light", label: "Light", hint: "Bright and clean", icon: Sun },
        { id: "dark", label: "Dark", hint: "Easy on the eyes", icon: Moon },
        { id: "system", label: "Automatic", hint: "Follows your device", icon: Monitor },
    ];

    return (
        <div className="mx-auto max-w-5xl pb-28">
            {/* who you are */}
            <header className="relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-8">
                <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-600/15 blur-3xl" />
                <div className="relative flex flex-wrap items-center gap-5">
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-3xl font-black text-white shadow-lg shadow-blue-600/30">{initials || "?"}</span>
                    <div className="min-w-0">
                        <h1 className="truncate text-3xl font-black tracking-tight">{name || "Your settings"}</h1>
                        <p className="truncate text-muted-foreground">{user?.email}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                            <span className="rounded-full bg-muted px-2.5 py-1">Signed in with {provider}</span>
                            {since && <span className="rounded-full bg-muted px-2.5 py-1">Member since {since}</span>}
                        </p>
                    </div>
                </div>
            </header>

            <div className="mt-8 grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
                {/* the rail */}
                <nav aria-label="Settings sections" className="hidden lg:block">
                    <ul className="sticky top-24 space-y-1">
                        {SECTIONS.map((s) => (
                            <li key={s.id}>
                                <a href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${active === s.id ? "bg-blue-600/10 text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                                    <s.icon className="h-4 w-4" /> {s.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>

                <form onSubmit={save} className="min-w-0 space-y-14" noValidate>
                    {/* account */}
                    <section id="account" className="scroll-mt-24" aria-labelledby="account-h">
                        <h2 id="account-h" className="text-xl font-extrabold">Account</h2>
                        <p className="mt-1 text-sm text-muted-foreground">This is how Kaizo greets you.</p>
                        <div className="mt-5 grid gap-5 sm:grid-cols-2">
                            <div>
                                <label htmlFor="s-name" className="mb-1.5 block text-sm font-semibold">Name</label>
                                <input id="s-name" className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" maxLength={80} disabled={saving} />
                            </div>
                            <div>
                                <label htmlFor="s-email" className="mb-1.5 block text-sm font-semibold">Email</label>
                                <input id="s-email" className={`${field} cursor-not-allowed bg-muted/50`} value={user?.email || ""} readOnly aria-describedby="s-email-h" />
                                <p id="s-email-h" className="mt-1.5 text-xs text-muted-foreground">Your email is how you sign in, so it cannot be changed here.</p>
                            </div>
                        </div>
                    </section>

                    {/* appearance */}
                    <section id="appearance" className="scroll-mt-24" aria-labelledby="appearance-h">
                        <h2 id="appearance-h" className="text-xl font-extrabold">Appearance</h2>
                        <p className="mt-1 text-sm text-muted-foreground">It changes right away, and is saved with the rest.</p>
                        <div role="radiogroup" aria-label="Theme" className="mt-5 grid gap-4 sm:grid-cols-3">
                            {THEMES.map((t) => {
                                const on = theme === t.id;
                                return (
                                    <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => setTheme(t.id)} className={`group rounded-2xl border-2 p-2 text-left transition-all ${on ? "border-blue-600 bg-blue-600/5" : "border-transparent bg-muted/40 hover:border-border"}`}>
                                        <span className="block aspect-[16/10] overflow-hidden rounded-xl ring-1 ring-black/10"><ThemeArt mode={t.id} /></span>
                                        <span className="mt-2.5 flex items-center justify-between px-1.5 pb-1">
                                            <span>
                                                <span className="flex items-center gap-1.5 text-sm font-bold"><t.icon className="h-4 w-4" /> {t.label}</span>
                                                <span className="block text-xs text-muted-foreground">{t.hint}</span>
                                            </span>
                                            <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${on ? "border-blue-600 bg-blue-600 text-white" : "border-border"}`}>{on && <Check className="h-3 w-3" strokeWidth={4} />}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* password */}
                    <section id="security" className="scroll-mt-24" aria-labelledby="security-h">
                        <h2 id="security-h" className="text-xl font-extrabold">Password</h2>
                        {isOAuth ? (
                            <p className="mt-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">You sign in with {provider}, so there is no Kaizo password to change. Manage it in that account.</p>
                        ) : (
                            <>
                                <p className="mt-1 text-sm text-muted-foreground">Leave these empty if you do not want to change it.</p>
                                <div className="mt-5 grid max-w-xl gap-5">
                                    <div>
                                        <label htmlFor="s-cur" className="mb-1.5 block text-sm font-semibold">Current password</label>
                                        <div className="relative">
                                            <input id="s-cur" className={`${field} pr-11`} type={show ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" disabled={saving} />
                                            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide passwords" : "Show passwords"} className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                                                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <div>
                                            <label htmlFor="s-new" className="mb-1.5 block text-sm font-semibold">New password</label>
                                            <input id="s-new" className={field} type={show ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" aria-describedby="s-strength" disabled={saving} />
                                        </div>
                                        <div>
                                            <label htmlFor="s-conf" className="mb-1.5 block text-sm font-semibold">Repeat it</label>
                                            <input id="s-conf" className={field} type={show ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" disabled={saving} />
                                        </div>
                                    </div>
                                    {newPassword && (
                                        <div id="s-strength" aria-live="polite">
                                            <div className="flex gap-1.5" aria-hidden>
                                                {[1, 2, 3, 4].map((i) => (
                                                    <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${score >= i ? (score <= 1 ? "bg-red-500" : score <= 2 ? "bg-amber-500" : "bg-green-500") : "bg-muted"}`} />
                                                ))}
                                            </div>
                                            <p className="mt-1.5 text-xs text-muted-foreground">{["Too short", "Weak", "Fair", "Good", "Strong"][score]}. Use 12 or more characters, with capitals, numbers and symbols.</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </section>

                    {/* your data */}
                    <section id="data" className="scroll-mt-24" aria-labelledby="data-h">
                        <h2 id="data-h" className="text-xl font-extrabold">Your data</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            You decide what Kaizo keeps. How it is used is in the <Link href="/privacy" className="font-medium text-blue-600 underline dark:text-blue-400">Privacy Policy</Link>.
                        </p>
                        <div className="mt-5 divide-y overflow-hidden rounded-2xl border">
                            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                                <div>
                                    <p className="font-semibold">Download a copy of your data</p>
                                    <p className="text-sm text-muted-foreground">Your profiles, applications, saved jobs and the list of your files, in one file.</p>
                                </div>
                                <Button type="button" variant="outline" onClick={handleExport} disabled={exporting} className="gap-2">
                                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {exporting ? "Preparing…" : "Download my data"}
                                </Button>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-4 bg-red-500/[0.04] p-5">
                                <div>
                                    <p className="font-semibold text-red-600 dark:text-red-400">Delete my account</p>
                                    <p className="text-sm text-muted-foreground">Removes your account, profiles, resumes, applications and saved jobs for good.</p>
                                </div>
                                <Button type="button" variant="outline" onClick={handleDeleteAccount} disabled={deleting} className="gap-2 border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400">
                                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {deleting ? "Deleting…" : "Delete my account"}
                                </Button>
                            </div>
                        </div>
                    </section>

                    {error && (
                        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
                    )}

                    {/* the save bar: only when something changed */}
                    {dirty && (
                        <div role="region" aria-label="Unsaved changes" className="fixed inset-x-3 bottom-4 z-30 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 pl-5 shadow-2xl backdrop-blur">
                            <p className="text-sm font-semibold"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-400" aria-hidden />You have unsaved changes</p>
                            <div className="flex gap-2">
                                <Button type="button" variant="ghost" onClick={discard} disabled={saving}>Discard</Button>
                                <Button type="submit" disabled={saving} className="gap-2">
                                    {saving && <Loader2 className="h-4 w-4 animate-spin" />} {saving ? "Saving…" : "Save changes"}
                                </Button>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
