"use client";

// Guest start (temporary): "Create my resume" lands here, gets a guest Firebase session (custom token from /api/guest) and goes straight to the
// app, with no sign-up. The backend sees a normal user id, so everything works the same.
// If this browser still has a resume half done from an earlier visit, we ask whether to continue it or start over.
// TODO(accounts): once sign-up is reworked, offer "save your resume" here and link this guest to a real account with
// linkWithCredential so nothing is lost. Until then the data lives only in this browser's session.
import LanguageSwitch from "@/components/languageSwitch";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { AnimatePresence, motion } from "framer-motion";
import { auth } from "@/lib/firebase";
import { loadTemplates } from "@/lib/templatePreload";
import PageLoader from "@/components/pageLoader";
import { authFetch } from "@/lib/authFetch";
import { ACCENT_KEY, DRAFT_KEY, ONBOARDING_KEY, TEMPLATE_KEY } from "@/components/onboarding";
import LivePreview from "@/components/livePreview";
import { draftToPreview, type SavedDraft } from "@/lib/draftPreview";
import { isTemplateId } from "@/lib/templates";
import { useT } from "@/i18n/provider";

type Phase = "working" | "ask" | "failed";

export default function StartPage() {
  const { tr } = useT();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("working");
  const cancelled = useRef(false);
  const [confirmNew, setConfirmNew] = useState(false);
  // the sheet that flies away when they continue, or crumples when they start over
  const [leaving, setLeaving] = useState<null | "continue" | "discard">(null);
  // what the unfinished resume holds, to show when the person comes back
  const [draft, setDraft] = useState<SavedDraft | null>(null);
  const [look, setLook] = useState<{ template: string; accent: string }>({ template: "classic", accent: "" });
  // what is already written, section by section, and how far along that puts the resume
  const parts = [
    { label: tr("Contact"), done: Boolean(draft?.name?.trim() && draft?.email?.trim()), detail: draft?.email?.trim() ?? "" },
    { label: tr("Summary"), done: Boolean(draft?.jobTitle?.trim() || draft?.objective?.trim()), detail: draft?.jobTitle?.trim() ?? "" },
    { label: tr("Skills"), done: Boolean(draft?.skills?.length), detail: draft?.skills?.length ? (draft.skills.length === 1 ? tr("1 skill") : tr("{n} skills", { n: draft.skills.length })) : "" },
    { label: tr("Experience"), done: Boolean(draft?.jobs?.length), detail: draft?.jobs?.length ? (draft.jobs.length === 1 ? tr("1 job") : tr("{n} jobs", { n: draft.jobs.length })) : "" },
    { label: tr("Education"), done: Boolean(draft?.edus?.length), detail: draft?.edus?.length ? (draft.edus.length === 1 ? tr("1 study") : tr("{n} studies", { n: draft.edus.length })) : "" },
  ];
  const doneCount = parts.filter((x) => x.done).length;
  const nextPart = parts.find((x) => !x.done);
  const firstName = (draft?.name ?? "").trim().split(/\s+/)[0] ?? "";
  const savedAgo = (() => {
    if (!draft?.savedAt) return "";
    const mins = Math.max(0, Math.round((Date.now() - draft.savedAt) / 60000));
    if (mins < 1) return tr("Saved just now");
    if (mins < 60) return tr("Saved {n} min ago", { n: mins });
    const hours = Math.round(mins / 60);
    if (hours < 24) return tr("Saved {n} h ago", { n: hours });
    return tr("Saved {n} days ago", { n: Math.round(hours / 24) });
  })();

  /** A brand new guest: what this browser kept from an earlier visit is not theirs. */
  const startFresh = useCallback(async () => {
    setPhase("working");
    try {
      if (auth.currentUser?.uid.startsWith("guest-")) {
        // what the old guest made is deleted from our servers, then they are signed out
        await authFetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) }).catch(() => {});
        await signOut(auth);
      }
      if (!auth.currentUser) {
        const res = await fetch("/api/guest", { method: "POST" });
        const { token } = await res.json();
        if (!res.ok || !token) throw new Error(tr("No guest token"));
        await signInWithCustomToken(auth, token);
      }
      try {
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem(ONBOARDING_KEY);
      } catch {
        /* storage unavailable */
      }
      // a guest goes straight to the builder (no dashboard); someone who already has an account keeps their dashboard
      if (!cancelled.current) router.replace(auth.currentUser?.uid.startsWith("guest-") ? "/build" : "/home");
    } catch (err) {
      console.error("Guest start failed", err);
      if (!cancelled.current) setPhase("failed");
    }
  }, [router]);

  useEffect(() => {
    cancelled.current = false;
    // start loading the "Pick a look" sheets now, so they are ready when the builder opens
    loadTemplates().catch(() => {});
    (async () => {
      await auth.authStateReady();
      let hasDraft = false;
      try {
        hasDraft = !!localStorage.getItem(DRAFT_KEY);
      } catch {
        /* storage unavailable */
      }
      // a guest with a resume in progress chooses; anything else starts clean
      if (auth.currentUser?.uid.startsWith("guest-") && hasDraft) {
        try {
          setDraft(JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"));
          const t = localStorage.getItem(TEMPLATE_KEY);
          setLook({ template: isTemplateId(t) ? t : "classic", accent: localStorage.getItem(ACCENT_KEY) ?? "" });
        } catch {
          /* an unreadable draft: the choice is shown without details */
        }
        if (!cancelled.current) setPhase("ask");
        return;
      }
      await startFresh();
    })();
    return () => {
      cancelled.current = true;
    };
  }, [startFresh]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <div className="absolute right-4 top-4"><LanguageSwitch tone="app" /></div>
      {phase === "failed" && (
        <>
          <p className="max-w-sm text-lg font-semibold">{tr("We couldn't start a guest session right now.")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{tr("Please try again in a moment.")}</p>
          <button onClick={() => window.location.reload()} className="rounded-md bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700">{tr("Try again")}</button>
        </>
      )}
      {phase === "ask" && (
        <div className="relative w-full max-w-4xl">
          {/* a slow glow behind the sheets */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[28rem] w-[46rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-blue-500/20 via-indigo-400/15 to-teal-300/20 blur-3xl"
            animate={{ scale: [1, 1.08, 1], rotate: [0, 6, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              {firstName ? tr("Welcome back, {name}.", { name: firstName }) : tr("Welcome back.")}
            </h1>
            <p className="mt-3 text-muted-foreground">{tr("You have a resume half done in this browser.")}{savedAgo ? ` ${savedAgo}.` : ""}</p>
          </motion.div>

          <div className="mt-12 grid items-center gap-14 sm:grid-cols-2">
            {/* the resume they left: a sheet on the table that floats; it flies away when they continue, and crumples when they discard it */}
            <motion.div
              initial={{ opacity: 0, y: 60, rotate: -9 }}
              animate={
                leaving === "continue"
                  ? { opacity: 0, y: -160, rotate: -2, scale: 1.08 }
                  : leaving === "discard"
                    ? { opacity: 0, y: 140, rotate: -28, scale: 0.35 }
                    : { opacity: 1, y: 0, rotate: -3 }
              }
              transition={leaving ? { duration: 0.55, ease: [0.5, 0, 0.75, 0] } : { type: "spring", stiffness: 120, damping: 16, delay: 0.15 }}
              className="relative mx-auto w-full max-w-[17rem]"
            >
              <motion.button
                onClick={() => {
                  if (leaving) return;
                  setLeaving("continue");
                  window.setTimeout(() => router.replace("/build"), 450);
                }}
                autoFocus
                aria-label={tr("Continue where I left off")}
                animate={leaving ? {} : { y: [0, -7, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: 1.04, rotate: 1.5 }}
                className="group relative block w-full overflow-hidden rounded-sm bg-white text-left shadow-[0_30px_60px_-24px_rgba(0,0,0,0.5)] ring-1 ring-black/10"
              >
                <div className="pointer-events-none select-none">
                  <LivePreview d={draftToPreview(draft ?? {}, look.accent)} template={look.template} active={null} inline bare />
                </div>
                {/* a light sweeps across the sheet now and then */}
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                  animate={{ x: ["0%", "480%"] }}
                  transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 4.5, ease: "easeInOut" }}
                />
              </motion.button>

              {/* the progress, as a tag stuck on the corner of the sheet */}
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 6 }}
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.7 }}
                className="absolute -right-6 -top-5 flex items-center gap-2.5 rounded-2xl bg-foreground py-2 pl-2 pr-4 text-background shadow-xl"
              >
                <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90" aria-hidden>
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" />
                  <motion.circle cx="18" cy="18" r="15" fill="none" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: Math.max(doneCount / parts.length, 0.04) }} transition={{ duration: 1.1, delay: 0.9, ease: [0.22, 1, 0.36, 1] }} />
                </svg>
                <span className="text-left leading-tight">
                  <span className="block text-sm font-extrabold tabular-nums">{doneCount}/{parts.length}</span>
                  <span className="block text-[11px] opacity-70">{nextPart ? tr("Next: {step}", { step: nextPart.label }) : tr("Everything is filled in")}</span>
                </span>
              </motion.div>

              <motion.p initial={{ opacity: 0 }} animate={{ opacity: leaving ? 0 : 1 }} transition={{ delay: 0.5 }} className="mt-7 text-center text-lg font-bold">{tr("Continue where I left off")}</motion.p>
            </motion.div>

            {/* the empty sheet: it writes itself over and over; it turns over to ask before throwing the other one away */}
            <motion.div initial={{ opacity: 0, y: 60, rotate: 9 }} animate={leaving ? { opacity: 0, scale: 0.9 } : { opacity: 1, y: 0, rotate: 3 }} transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.3 }} className="relative mx-auto w-full max-w-[17rem] [perspective:1000px]">
              <motion.div animate={{ rotateY: confirmNew ? 180 : 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="relative aspect-[210/297] [transform-style:preserve-3d]">
                <button
                  onClick={() => setConfirmNew(true)}
                  className="group absolute inset-0 flex flex-col justify-center rounded-sm border-2 border-dashed border-foreground/25 bg-background/70 p-7 text-left backdrop-blur-sm transition-colors hover:border-blue-500 [backface-visibility:hidden]"
                >
                  <div className="space-y-3">
                    {[78, 56, 92, 64, 40].map((w, i) => (
                      <motion.div key={i} className="h-2 rounded-full bg-foreground/10 group-hover:bg-blue-500/30" initial={{ width: "8%" }} animate={{ width: ["8%", `${w}%`, `${w}%`, "8%"] }} transition={{ duration: 6, repeat: Infinity, delay: i * 0.5, times: [0, 0.35, 0.8, 1], ease: "easeInOut" }} />
                    ))}
                  </div>
                  <span className="mt-8 inline-flex items-center gap-2 text-lg font-bold">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xl font-light leading-none text-background transition-transform duration-300 group-hover:rotate-90 group-hover:bg-blue-600">+</span>
                    {tr("Start a new one")}
                  </span>
                </button>
                <div className="absolute inset-0 flex flex-col justify-center rounded-sm bg-foreground p-7 text-left text-background [backface-visibility:hidden] [transform:rotateY(180deg)]" aria-hidden={!confirmNew}>
                  <p className="text-xl font-extrabold leading-snug">{tr("Start over?")}</p>
                  <p className="mt-2 text-sm opacity-70">{tr("The one in progress will be discarded.")}</p>
                  <div className="mt-6 flex flex-col gap-2">
                    <button
                      tabIndex={confirmNew ? 0 : -1}
                      onClick={() => {
                        if (leaving) return;
                        setLeaving("discard");
                        window.setTimeout(() => void startFresh(), 500);
                      }}
                      className="rounded-md bg-red-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-600"
                    >
                      {tr("Yes, start over")}
                    </button>
                    <button tabIndex={confirmNew ? 0 : -1} onClick={() => setConfirmNew(false)} className="rounded-md px-4 py-2.5 text-sm font-semibold opacity-80 transition-opacity hover:opacity-100">
                      {tr("Keep it")}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      )}
      <AnimatePresence>{phase === "working" && <PageLoader key="loader" label={tr("Getting your resume builder ready…")} />}</AnimatePresence>
      {phase !== "failed" && (
        <p className="max-w-sm text-xs text-muted-foreground">{tr("By continuing you confirm that you are 16 or older and accept the")}{" "}<Link href="/terms" className="underline">{tr("Terms")}</Link>{" "}{tr("and the")}{" "}<Link href="/privacy" className="underline">{tr("Privacy Policy")}</Link>.
        </p>
      )}
    </main>
  );
}
