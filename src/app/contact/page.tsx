"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircle2Icon, Loader2Icon, MailIcon, ShieldCheckIcon, LifeBuoyIcon } from "lucide-react";
import SiteFooter from "@/components/siteFooter";

const TOPICS = [
  { id: "question", label: "A question about Kaizo" },
  { id: "problem", label: "Something is not working" },
  { id: "privacy", label: "My data and privacy (access, delete, close account)" },
  { id: "feedback", label: "An idea or feedback" },
  { id: "other", label: "Something else" },
];

const field = "mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3.5 py-2.5 text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", topic: "question", message: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setState("sending");
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "We couldn't send your message. Please try again.");
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't send your message. Please try again.");
      setState("idle");
    }
  };

  return (
    <div className="public-site min-h-screen bg-white font-sans text-gray-900" style={{ colorScheme: "light" }}>
      <header className="border-b border-gray-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" aria-label="Kaizo home">
            <Image src="/kaizologo.png" alt="Kaizo Resume Builder" width={105} height={35} priority />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600">
            <ArrowLeftIcon className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto grid max-w-6xl outline-none gap-12 px-4 py-14 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Contact us</h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-gray-600">Tell us what you need and a person reads it. We answer by email.</p>
          <ul className="mt-8 space-y-5 text-sm">
            <li className="flex gap-3">
              <LifeBuoyIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <span>
                <strong className="block text-gray-900">Need help using Kaizo?</strong>
                <span className="text-gray-600">Many answers are in the <Link href="/#faq" className="font-medium text-blue-600 underline">frequently asked questions</Link>.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <span>
                <strong className="block text-gray-900">Your data</strong>
                <span className="text-gray-600">To see, correct, export or delete your data, or to close your account, choose that topic. Read how we handle it in the <Link href="/privacy" className="font-medium text-blue-600 underline">Privacy Policy</Link>.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <MailIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <span>
                <strong className="block text-gray-900">What happens to your message</strong>
                <span className="text-gray-600">We store it only to answer you. We do not add you to any mailing list.</span>
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          {state === "sent" ? (
            <div className="py-10 text-center" role="status">
              <CheckCircle2Icon className="mx-auto h-12 w-12 text-green-600" />
              <h2 className="mt-4 text-2xl font-bold">Message sent</h2>
              <p className="mx-auto mt-2 max-w-sm text-gray-600">Thank you. We will answer at {form.email}. Check your spam folder if you do not see it in a few days.</p>
              <Link href="/" className="mt-6 inline-block font-semibold text-blue-600 hover:underline">Back to home</Link>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Your name
                  <input className={field} value={form.name} onChange={set("name")} autoComplete="name" maxLength={100} required />
                </label>
                <label className="block text-sm font-medium">
                  Your email
                  <input className={field} type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
                </label>
              </div>
              <label className="mt-5 block text-sm font-medium">
                What is it about?
                <select className={field} value={form.topic} onChange={set("topic")}>
                  {TOPICS.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="mt-5 block text-sm font-medium">
                Your message
                <textarea className={`${field} min-h-40 resize-y`} value={form.message} onChange={set("message")} maxLength={4000} required />
                <span className="mt-1 block text-right text-xs text-gray-500">{form.message.length}/4000</span>
              </label>
              {/* a field for bots: people never see it */}
              <div className="absolute -left-[9999px]" aria-hidden>
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
                </label>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                By sending this you agree that we use your details to answer you, as explained in the <Link href="/privacy" className="underline">Privacy Policy</Link>.
              </p>
              {error && (
                <p role="alert" className="mt-4 rounded-md bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>
              )}
              <button type="submit" disabled={state === "sending"} className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-blue-600 px-6 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
                {state === "sending" && <Loader2Icon className="h-4 w-4 animate-spin" />}
                {state === "sending" ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
