"use client";

import LanguageSwitch from "@/components/languageSwitch";
import LiveResumeCount from "@/components/liveResumeCount";
import { useAuth } from "@/context/authContext";
import { useRouter } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { LoginForm } from "@/components/forms/loginForm";
import { RegistrationForm } from "@/components/forms/registrationForm";
import { ResetPasswordForm } from "@/components/forms/resetPasswordForm";
import Image from "next/image";
import Link from "@/i18n/navigation";
import { ArrowLeftIcon, CheckIcon, SparklesIcon } from "lucide-react";
import { useT } from "@/i18n/provider";

const perks = [
  "AI-written bullet points tailored to each job",
  "ATS-friendly templates, ready as PDF",
  "Import your old resume, skip the retyping",
];

export default function Page() {
  const { tr } = useT();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<"login" | "register" | "resetPassword">("login");
  const [isMounted, setIsMounted] = useState(false);

  // Handle authenticated redirect. A guest (building a resume with no account) is not logged in: they come here to log in,
  // so they are not sent back to the app (that sent them in a loop between /home and /build)
  useEffect(() => {
    if (!loading && user && !user.uid.startsWith("guest-")) {
      router.push("/home");
    }
  }, [user, loading, router]);

  // Detect changes to URL manually
  useEffect(() => {
    const handleRouteChange = () => {
      const params = new URLSearchParams(window.location.search);
      const queryView = params.get("view");

      if (queryView === "register") {
        setView("register");
      } else if (queryView === "resetPassword") {
        setView("resetPassword");
      } else if (queryView === "login") {
        setView("login");
      } else {
        setView("login");
      }
    };

    handleRouteChange();

    window.addEventListener("popstate", handleRouteChange);
    window.addEventListener("pushstate", handleRouteChange);
    window.addEventListener("replacestate", handleRouteChange);

    return () => {
      window.removeEventListener("popstate", handleRouteChange);
      window.removeEventListener("pushstate", handleRouteChange);
      window.removeEventListener("replacestate", handleRouteChange);
    };
  }, [router]);

  // Enable transition
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const linkBtn = "text-blue-600 font-semibold hover:underline";

  return (
    <div className="auth-light min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-white">
      {/* ============ Brand panel ============ */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white p-12">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-teal-300/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -right-24 w-96 h-96 bg-indigo-300/30 rounded-full blur-3xl" />

        <Link
          href="/"
          className="relative inline-flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white w-fit"
        >
          <ArrowLeftIcon className="w-4 h-4" />{" "}{tr("Back to home")}</Link>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-sm font-semibold px-3 py-1 rounded-md mb-6">
            <SparklesIcon className="w-4 h-4" />{" "}{tr("AI-powered resume builder")}</span>
          <h2 className="text-4xl xl:text-5xl font-extrabold leading-[1.1] tracking-tight mb-6">{tr("Build a resume that gets you hired.")}</h2>
          <ul className="space-y-3 mb-10">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3 text-blue-50">
                <span className="mt-0.5 w-5 h-5 rounded bg-white/20 flex items-center justify-center shrink-0">
                  <CheckIcon className="w-3.5 h-3.5" strokeWidth={3} />
                </span>
                {tr(p)}
              </li>
            ))}
          </ul>

          <div className="mb-8">
            <LiveResumeCount tone="dark" variant="tiles" />
          </div>

        </div>

        <p className="relative text-sm text-blue-100/80">
          © {new Date().getFullYear()}{" "}{tr("Kaizo Resume Builder")}</p>
      </aside>

      {/* ============ Form panel ============ */}
      <main id="main" tabIndex={-1} className="flex flex-col px-6 py-8 outline-none sm:px-12">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image src="/kaizologo-v2.png" unoptimized alt={tr("Kaizo Resume Builder")} width={120} height={40} priority />
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitch />
            <Link
              href="/"
              className="lg:hidden text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
            >
              <ArrowLeftIcon className="w-4 h-4" />{" "}{tr("Home")}</Link>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center py-10">
          <div
            className={`w-full max-w-sm transition duration-500 ease-out ${
              isMounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {view === "login" && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">{tr("Welcome back")}</h1>
                <p className="text-gray-600 mb-8">{tr("New to Kaizo?")}{" "}
                  <button onClick={() => setView("register")} className={linkBtn}>{tr("Create a free account")}</button>
                </p>
                <LoginForm
                  onLogin={() => router.push("/home")}
                  onForgotPassword={() => setView("resetPassword")}
                />
              </>
            )}

            {view === "register" && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">{tr("Create your account")}</h1>
                <p className="text-gray-600 mb-8">{tr("Already have one?")}{" "}
                  <button onClick={() => setView("login")} className={linkBtn}>{tr("Log in")}</button>
                </p>
                <RegistrationForm onRegister={() => setView("login")} />
              </>
            )}

            {view === "resetPassword" && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">{tr("Reset your password")}</h1>
                <p className="text-gray-600 mb-8">{tr("Enter your email and we'll send you a link to get back in.")}</p>
                <ResetPasswordForm
                  onSuccess={() => setView("login")}
                  buttonText="Send reset link"
                />
                <p className="text-sm text-gray-600 mt-6">{tr("Remembered it?")}{" "}
                  <button onClick={() => setView("login")} className={linkBtn}>{tr("Back to log in")}</button>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
