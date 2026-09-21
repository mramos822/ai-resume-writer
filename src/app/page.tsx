"use client";

import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoginForm } from "@/components/forms/loginForm";
import { RegistrationForm } from "@/components/forms/registrationForm";
import { ResetPasswordForm } from "@/components/forms/resetPasswordForm";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, CheckIcon, SparklesIcon, StarIcon } from "lucide-react";

const perks = [
  "AI-written bullet points tailored to each job",
  "ATS-friendly templates, ready as PDF",
  "Import your old resume, skip the retyping",
];

export default function Page() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<"login" | "register" | "resetPassword">("login");
  const [isMounted, setIsMounted] = useState(false);

  // Handle authenticated redirect
  useEffect(() => {
    if (!loading && user) {
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
        // No explicit view: show the marketing landing page
        router.replace("/homepage");
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
          href="/homepage"
          className="relative inline-flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white w-fit"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Back to home
        </Link>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-sm font-semibold px-3 py-1 rounded-md mb-6">
            <SparklesIcon className="w-4 h-4" /> AI-powered resume builder
          </span>
          <h2 className="text-4xl xl:text-5xl font-extrabold leading-[1.1] tracking-tight mb-6">
            Build a resume that gets you hired.
          </h2>
          <ul className="space-y-3 mb-10">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3 text-blue-50">
                <span className="mt-0.5 w-5 h-5 rounded bg-white/20 flex items-center justify-center shrink-0">
                  <CheckIcon className="w-3.5 h-3.5" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>

          <div className="bg-white/10 border border-white/20 rounded-md p-5 backdrop-blur">
            <div className="flex gap-0.5 text-amber-300 mb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon key={i} className="w-4 h-4 fill-current" />
              ))}
            </div>
            <p className="text-white/95">“I had my resume ready in 10 minutes!”</p>
            <p className="text-sm text-blue-100 mt-2">Oscar W. · Project Manager</p>
          </div>
        </div>

        <p className="relative text-sm text-blue-100/80">
          © {new Date().getFullYear()} Kaizo Resume Builder
        </p>
      </aside>

      {/* ============ Form panel ============ */}
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Link href="/homepage" className="flex items-center">
            <Image src="/kaizologo.png" alt="Kaizo Resume Builder" width={150} height={20} priority />
          </Link>
          <Link
            href="/homepage"
            className="lg:hidden text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
          >
            <ArrowLeftIcon className="w-4 h-4" /> Home
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center py-10">
          <div
            className={`w-full max-w-sm transition duration-500 ease-out ${
              isMounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {view === "login" && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">
                  Welcome back
                </h1>
                <p className="text-gray-600 mb-8">
                  New to Kaizo?{" "}
                  <button onClick={() => setView("register")} className={linkBtn}>
                    Create a free account
                  </button>
                </p>
                <LoginForm
                  onLogin={() => router.push("/home")}
                  onForgotPassword={() => setView("resetPassword")}
                />
              </>
            )}

            {view === "register" && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">
                  Create your account
                </h1>
                <p className="text-gray-600 mb-8">
                  Already have one?{" "}
                  <button onClick={() => setView("login")} className={linkBtn}>
                    Log in
                  </button>
                </p>
                <RegistrationForm onRegister={() => setView("login")} />
              </>
            )}

            {view === "resetPassword" && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">
                  Reset your password
                </h1>
                <p className="text-gray-600 mb-8">
                  Enter your email and we&apos;ll send you a link to get back in.
                </p>
                <ResetPasswordForm
                  onSuccess={() => setView("login")}
                  buttonText="Send reset link"
                />
                <p className="text-sm text-gray-600 mt-6">
                  Remembered it?{" "}
                  <button onClick={() => setView("login")} className={linkBtn}>
                    Back to log in
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
