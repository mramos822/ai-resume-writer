"use client";

// Guest start (temporary): "Create my resume" lands here, gets a guest Firebase session (custom token from /api/guest) and goes straight to the
// app, with no sign-up. The backend sees a normal user id, so everything works the same.
// If this browser still has a resume half done from an earlier visit, we ask whether to continue it or start over.
// TODO(accounts): once sign-up is reworked, offer "save your resume" here and link this guest to a real account with
// linkWithCredential so nothing is lost. Until then the data lives only in this browser's session.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { FileClock, RotateCcw } from "lucide-react";
import { auth } from "@/lib/firebase";
import { loadTemplates } from "@/lib/templatePreload";
import PageLoader from "@/components/pageLoader";
import { DRAFT_KEY, ONBOARDING_KEY } from "@/components/onboarding";

type Phase = "working" | "ask" | "failed";

export default function StartPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("working");
  const cancelled = useRef(false);

  /** A brand new guest: what this browser kept from an earlier visit is not theirs. */
  const startFresh = useCallback(async () => {
    setPhase("working");
    try {
      if (auth.currentUser?.uid.startsWith("guest-")) await signOut(auth);
      if (!auth.currentUser) {
        const res = await fetch("/api/guest", { method: "POST" });
        const { token } = await res.json();
        if (!res.ok || !token) throw new Error("No guest token");
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
      {phase === "failed" && (
        <>
          <p className="max-w-sm text-lg font-semibold">We couldn&apos;t start a guest session right now.</p>
          <p className="max-w-sm text-sm text-muted-foreground">Please try again in a moment.</p>
          <button onClick={() => window.location.reload()} className="rounded-md bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700">
            Try again
          </button>
        </>
      )}
      {phase === "ask" && (
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-extrabold tracking-tight">You have a resume in progress</h1>
          <p className="mt-2 text-muted-foreground">You left one half done in this browser. Do you want to keep working on it?</p>
          <div className="mt-6 grid gap-3">
            <button onClick={() => router.replace("/build")} className="flex items-center gap-3 rounded-xl bg-blue-600 px-5 py-4 text-left text-white transition-colors hover:bg-blue-700">
              <FileClock className="h-6 w-6 shrink-0" />
              <span>
                <span className="block font-bold">Continue where I left off</span>
                <span className="block text-sm text-blue-100">Everything you wrote is still there.</span>
              </span>
            </button>
            <button onClick={startFresh} className="flex items-center gap-3 rounded-xl border px-5 py-4 text-left transition-colors hover:bg-accent">
              <RotateCcw className="h-6 w-6 shrink-0 text-muted-foreground" />
              <span>
                <span className="block font-bold">Start a new one</span>
                <span className="block text-sm text-muted-foreground">The one in progress will be discarded.</span>
              </span>
            </button>
          </div>
        </div>
      )}
      {phase === "working" && <PageLoader label="Getting your resume builder ready…" />}
    </main>
  );
}
