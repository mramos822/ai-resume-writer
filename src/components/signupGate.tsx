"use client";

// The step between "my resume is ready" and "download": a guest has to have an account. New account or an existing one, their
// resume moves to it, and they land in the dashboard with the resume ready in Resumes.
import React, { useEffect, useRef, useState } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { createUserWithEmailAndPassword, getAdditionalUserInfo, GoogleAuthProvider, sendEmailVerification, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from "firebase/auth";
import { CheckCircle2, MailCheck, Loader2, Check } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { getFriendlyFirebaseErrorMessage } from "@/utils/firebaseErrorHandler";
import { DRAFT_KEY, ONBOARDING_KEY } from "@/components/onboarding";
import { useT } from "@/i18n/provider";

export const CLAIMING_KEY = "kaizo_claiming";

const field = "h-11 w-full rounded-lg border bg-background px-3.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50";

export default function SignupGate({ open, onClose, template, startMode = "register", quick = false, onLoggedIn }: { open: boolean; onClose: () => void; template: string; startMode?: "register" | "login"; quick?: boolean; onLoggedIn?: (profileId: string | null) => void }) {
  const { tr, trd, locale } = useT();
  const router = useRouter();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verify, setVerify] = useState(false); // new email account: it must be confirmed before logging in
  const [done, setDone] = useState<{ kind: "created" | "loggedin"; profileId: string | null; mergedInto?: string } | null>(null);
  const [verifyProfile, setVerifyProfile] = useState<string | null>(null);
  const guestToken = useRef<string | null>(null);
  // after logging in: the profiles of the account, to choose where this resume goes ("new" = the profile made for it)
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [target, setTarget] = useState<string>("new");
  const [going, setGoing] = useState(false);

  /** The builder is closed for good: its draft is cleared and the first-time setup is marked as done. */
  const leave = (to: string, profileId: string | null) => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.setItem(ONBOARDING_KEY, "1");
      if (profileId) sessionStorage.setItem("kaizo_open_profile", profileId);
      sessionStorage.removeItem(CLAIMING_KEY);
    } catch {
      /* storage unavailable */
    }
    router.push(to);
  };

  // the guest's own token is taken now, while they are still the guest: it proves the resume is theirs
  useEffect(() => {
    if (!open) return;
    setMode(startMode);
    guestToken.current = null;
    auth.currentUser?.getIdToken().then((t) => (guestToken.current = t)).catch(() => {});
  }, [open]);

  // when the account is ready, load its profiles so the person can choose which one the resume goes to
  useEffect(() => {
    if (!done?.profileId) return;
    setTarget("new");
    auth.currentUser
      ?.getIdToken()
      .then((t) => fetch("/api/profiles", { headers: { Authorization: `Bearer ${t}` } }))
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { id: string; name: string; data?: { jobTitle?: string; careerObjective?: string; skills?: unknown[]; jobHistory?: unknown[]; education?: unknown[] } }[]) =>
        setProfiles(
          list
            .filter((p) => p.id === done.profileId || p.data?.jobTitle || p.data?.careerObjective || p.data?.skills?.length || p.data?.jobHistory?.length || p.data?.education?.length)
            .map((p) => ({ id: p.id, name: p.name }))
        )
      )
      .catch(() => setProfiles([]));
  }, [done]);

  /** To the dashboard with the chosen profile open; an existing profile first receives the resume. */
  const goToDashboard = async () => {
    if (!done || going) return;
    setGoing(true);
    setError("");
    try {
      let profileId = done.profileId;
      if (done.profileId && target !== "new") {
        const t = await auth.currentUser?.getIdToken();
        const res = await fetch("/api/account/place-resume", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ fromProfileId: done.profileId, toProfileId: target }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(trd(data.error) || tr("We couldn't move your resume to that profile."));
        profileId = data.profileId;
      }
      if (quick) {
        // back to the builder, now working on that profile
        setGoing(false);
        onClose();
        onLoggedIn?.(profileId);
        return;
      }
      leave("/home", profileId);
    } catch (e) {
      setError((e as Error).message);
      setGoing(false);
    }
  };

  const finish = async (user: User, isNew: boolean) => {
    sessionStorage.setItem(CLAIMING_KEY, String(Date.now())); // the builder must not send them away while the resume moves
    try {
      const token = await user.getIdToken(true);
      const gt = guestToken.current;
      let profileId: string | null = null;
      let mergedInto: string | undefined;
      if (gt) {
        const res = await fetch("/api/account/claim", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ guestToken: gt }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(trd(data.error) || tr("We couldn't move your resume to your account."));
        profileId = data.profileId;
        mergedInto = data.mergedInto;
      }
      // the resume now lives in the account: the builder's draft is no longer needed. Without this, closing the window and coming back
      // later would open the step-by-step builder again instead of the dashboard.
      try {
        localStorage.removeItem(DRAFT_KEY);
        localStorage.setItem(ONBOARDING_KEY, "1");
        if (profileId) sessionStorage.setItem("kaizo_open_profile", profileId);
      } catch {
        /* storage unavailable */
      }

      if (quick) {
        // a log in from the builder (the "this email already has an account" notice): the resume is in the account now. The person picks the
        // profile it goes to and stays in the builder, which keeps its place. The builder is not sent away meanwhile.
        setDone({ kind: "loggedin", profileId, mergedInto });
        return;
      }

      if (!user.emailVerified) {
        // a new email account: the resume is already saved in it, but the email has to be confirmed before logging in
        if (isNew) await sendEmailVerification(user).catch(() => {});
        await signOut(auth).catch(() => {});
        setVerify(true);
        setVerifyProfile(profileId);
        return;
      }

      // make the resume now, so it is waiting in Resumes
      let fileId = "";
      if (profileId) {
        const g = await fetch("/api/generate-resume", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ profileId, template: template || "classic", format: "pdf", builder: true, lang: locale }) });
        const gd = await g.json().catch(() => ({}));
        if (g.ok && gd.fileId) fileId = gd.fileId;
      }
      void fileId; // the resume is made, so it is waiting in Resumes
      setDone({ kind: isNew ? "created" : "loggedin", profileId, mergedInto });
    } catch (e) {
      sessionStorage.removeItem(CLAIMING_KEY);
      throw e;
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError(tr("Enter a valid email."));
    if (password.length < 6) return setError(tr("The password needs at least 6 characters."));
    if (mode === "register") {
      if (password !== confirm) return setError(tr("The passwords do not match."));
      if (!agreed) return setError(tr("Please confirm that you are 16 or older and accept the terms to continue."));
    }
    setBusy(true);
    try {
      const cred = mode === "register" ? await createUserWithEmailAndPassword(auth, email.trim(), password) : await signInWithEmailAndPassword(auth, email.trim(), password);
      if (mode === "login") await cred.user.reload();
      if (mode === "login" && !cred.user.emailVerified) {
        await signOut(auth).catch(() => {});
        setError(tr("Your email is not verified yet. Open the verification email we sent you, then log in again."));
        return;
      }
      await finish(cred.user, mode === "register");
    } catch (err) {
      setError(err instanceof Error && !("code" in err) ? err.message : getFriendlyFirebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (busy) return;
    if (mode === "register" && !agreed) return setError(tr("Please confirm that you are 16 or older and accept the terms to continue."));
    setBusy(true);
    setError("");
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await finish(cred.user, getAdditionalUserInfo(cred)?.isNewUser === true);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "auth/cancelled-popup-request" && code !== "auth/popup-closed-by-user") setError(code ? getFriendlyFirebaseErrorMessage(err) : (err as Error).message || tr("We couldn't sign you in with Google."));
    } finally {
      setBusy(false);
    }
  };

  // the sign-up form is wide, with the illustration beside it; the "done" and "check your email" messages stay small
  const form = !done && !verify;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o || busy) return;
        // the X of the "done" notice only closes it, the builder stays where it was
        if (done) void (quick ? goToDashboard() : onClose());
        else if (verify) leave("/login?view=login", verifyProfile);
        else onClose();
      }}
    >
      <DialogContent className={form ? "gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl" : "rounded-2xl sm:max-w-md"}>
        {done ? (
          <div className="py-4 text-center" role="status">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
            <DialogTitle className="mt-4 text-2xl font-extrabold">{done.kind === "created" ? tr("Account created") : tr("You are logged in")}</DialogTitle>
            <DialogDescription className="mt-2">
              {quick ? tr("Welcome back. Your resume is in your account. Keep going here, and when you download it you will find it in Resumes.") : <>{done.kind === "created" ? tr("Welcome to Kaizo. ") : tr("Welcome back. ")}{tr("Your resume is saved in your account. Find it any time in")}{" "}<strong>{tr("Resumes")}</strong>{tr(", in the side menu, ready to download.")}</>}</DialogDescription>
            {done.mergedInto !== undefined && (
              <p className="mt-4 rounded-xl border border-blue-600/30 bg-blue-600/5 px-4 py-3 text-left text-sm">
                {tr("We found your profile")} <strong>{done.mergedInto}</strong>{tr(" and added this resume to it, so you do not end up with two profiles of the same person.")}
              </p>
            )}
            {done.mergedInto === undefined && profiles.length > 1 && (
              <fieldset className="mt-5 text-left">
                <legend className="mb-2 text-sm font-bold">{tr("Which profile should this resume go to?")}</legend>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {[{ id: "new", name: "" }, ...profiles.filter((p) => p.id !== done.profileId)].map((p) => (
                    <label key={p.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors ${target === p.id ? "border-blue-600 bg-blue-600/5" : "hover:bg-accent"}`}>
                      <input type="radio" name="gate-profile" checked={target === p.id} onChange={() => setTarget(p.id)} className="mt-1 h-4 w-4 accent-blue-600" />
                      <span className="min-w-0">
                        <span className="block font-semibold">{p.id === "new" ? tr("A new profile with this resume") : p.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.id === "new" ? tr("Your other profiles stay as they are.") : tr("Its current details will be replaced by this resume.")}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {error && <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-left text-sm text-red-500">{error}</p>}
            <Button onClick={goToDashboard} disabled={going} className="mt-6 h-11 w-full gap-2 font-bold">
              {going && <Loader2 className="h-4 w-4 animate-spin" />}
              {quick ? tr("Continue") : tr("Go to dashboard")}
            </Button>
          </div>
        ) : verify ? (
          <div className="py-4 text-center" role="status">
            <MailCheck className="mx-auto h-12 w-12 text-green-500" />
            <DialogTitle className="mt-4 text-xl font-extrabold">{tr("Account created: check your email")}</DialogTitle>
            <DialogDescription className="mt-2">{tr("Your resume is saved in your new account. We sent a link to")}{" "}<strong>{email}</strong>{tr(": confirm it, log in, and your resume will be waiting in Resumes, ready to download.")}</DialogDescription>
            <Button onClick={() => leave("/login?view=login", verifyProfile)} className="mt-6 w-full">{tr("Go to log in")}</Button>
          </div>
        ) : (
          <div className="grid md:h-[min(46rem,calc(100vh-2rem))] md:grid-cols-[1fr_1.15fr]">
            {/* the side with the illustration: what you get */}
            <div
              className="relative flex min-h-36 flex-col justify-end gap-4 bg-cover bg-no-repeat p-6 md:min-h-0 md:justify-between md:p-8"
              style={{ backgroundImage: "url(/gate-bg.webp)", backgroundPosition: "68% 60%" }}
            >
              <div className="max-md:hidden">
                <p className="text-xs font-bold uppercase tracking-widest text-blue-700">{tr("Your resume is ready.")}</p>
              </div>
              <ul className="space-y-3 rounded-2xl bg-white/70 p-4 text-sm font-medium text-slate-800 shadow-sm backdrop-blur max-md:hidden">
                {[tr("Download it as a PDF"), tr("It stays saved in your account, one click away"), tr("Adapt it to every job you apply to")].map((x) => (
                  <li key={x} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"><Check className="h-3 w-3" /></span>
                    {x}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex min-w-0 flex-col gap-5 p-6 md:justify-start md:overflow-y-auto md:p-9 md:pt-12">
              <DialogTitle className="text-xl font-extrabold">{quick ? tr("Log in to your account") : mode === "register" ? tr("Create your free account to download") : tr("Log in to download")}</DialogTitle>
              <DialogDescription>{quick ? tr("Log in and your resume moves to your account. You keep working here.") : <>{tr("Your resume is ready.")}{" "}{mode === "register" ? tr("Create an account and it is saved for you, with every other resume you make.") : tr("Log in and this resume is added to your account.")}</>}
              </DialogDescription>

              {!quick && <div role="tablist" className="inline-flex w-fit rounded-full border p-1 text-sm font-semibold">
                {(["register", "login"] as const).map((m) => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(""); }} className={`rounded-full px-4 py-1.5 ${mode === m ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground"}`}>
                    {m === "register" ? tr("Create account") : tr("I have an account")}
                  </button>
                ))}
              </div>}

              <form onSubmit={submit} className="space-y-3.5" noValidate>
                <div>
                  <label htmlFor="gate-email" className="mb-1 block text-sm font-semibold">{tr("Email")}</label>
                  <input id="gate-email" type="email" autoComplete="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
                </div>
                <div>
                  <label htmlFor="gate-pw" className="mb-1 block text-sm font-semibold">{tr("Password")}</label>
                  <input id="gate-pw" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} className={field} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
                </div>
                {mode === "register" && (
                  <>
                    <div>
                      <label htmlFor="gate-pw2" className="mb-1 block text-sm font-semibold">{tr("Repeat the password")}</label>
                      <input id="gate-pw2" type="password" autoComplete="new-password" className={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} />
                    </div>
                    <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
                      <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" />
                      <span>{tr("I am 16 or older, and I accept the")}{" "}<Link href="/terms" target="_blank" className="underline">{tr("Terms of Service")}</Link>{" "}{tr("and the")}{" "}<Link href="/privacy" target="_blank" className="underline">{tr("Privacy Policy")}</Link>.
                      </span>
                    </label>
                  </>
                )}
                {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-500">{error}</p>}
                <Button type="submit" disabled={busy} className="h-11 w-full gap-2 font-bold">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "register" ? tr("Create account and continue") : tr("Log in and continue")}
                </Button>
              </form>

              <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />{" "}{tr("or")}{" "}<span className="h-px flex-1 bg-border" /></div>
              <Button type="button" variant="outline" onClick={google} disabled={busy} className="h-11 w-full gap-2">
                <FcGoogle className="h-5 w-5" />{" "}{tr("Continue with Google")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
