"use client";

// Contact messages, for the people who run Kaizo (ADMIN_EMAILS). Shows how long each has waited: the Privacy Policy promises an
// answer within 45 days (30 for most other requests).
import React, { useEffect, useMemo, useState } from "react";
import Link from "@/i18n/navigation";
import { Check, Inbox, Mail, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/toastContext";
import { authFetch } from "@/lib/authFetch";
import { useT } from "@/i18n/provider";

interface Message {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  status: "new" | "answered";
  createdAt: string;
}

const TOPIC: Record<string, string> = { question: "Question", problem: "Problem", privacy: "Privacy request", appeal: "Privacy appeal", feedback: "Feedback", other: "Other" };
const days = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export default function AdminMessagesPage() {
  const { tr } = useT();
  const toast = useToast();
  const [rows, setRows] = useState<Message[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [filter, setFilter] = useState<"new" | "all">("new");

  useEffect(() => {
    authFetch("/api/admin/messages")
      .then(async (r) => {
        if (r.status === 403 || r.status === 401) return setDenied(true);
        if (!r.ok) throw new Error();
        setRows((await r.json()).messages);
      })
      .catch(() => toast.error(tr("We couldn't load the messages.")));
  }, [toast]);

  const setStatus = async (m: Message, status: Message["status"]) => {
    setRows((list) => list?.map((x) => (x.id === m.id ? { ...x, status } : x)) ?? null);
    try {
      const res = await authFetch("/api/admin/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id, status }) });
      if (!res.ok) throw new Error();
    } catch {
      toast.error(tr("We couldn't update that message."));
      setRows((list) => list?.map((x) => (x.id === m.id ? { ...x, status: m.status } : x)) ?? null);
    }
  };

  const shown = useMemo(() => (rows ?? []).filter((m) => filter === "all" || m.status === "new"), [rows, filter]);
  const waiting = (rows ?? []).filter((m) => m.status === "new").length;

  if (denied) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <h1 className="text-2xl font-extrabold">{tr("This page is for the Kaizo team")}</h1>
        <p className="mt-2 text-muted-foreground">{tr("Your account is not on the list of administrators.")}</p>
        <Button asChild className="mt-6"><Link href="/home">{tr("Back to the dashboard")}</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{tr("Messages")}</h1>
          <p className="mt-1 text-muted-foreground">{rows === null ? tr("Loading…") : tr("{waiting} waiting for an answer", { waiting })}</p>
        </div>
        <div role="tablist" className="inline-flex rounded-full border bg-card p-1 shadow-sm">
          {(["new", "all"] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${filter === f ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground"}`}>
              {f === "new" ? tr("Waiting") : tr("All")}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {shown.map((m) => {
          const d = days(m.createdAt);
          const late = m.status === "new" && d >= 30;
          return (
            <li key={m.id} className={`rounded-xl border bg-card p-5 ${late ? "border-amber-500/60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">
                  {m.name} <span className="font-normal text-muted-foreground">· {m.email}</span>
                </p>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-muted px-2.5 py-1">{TOPIC[m.topic] ?? m.topic}</span>
                  <span className={`rounded-full px-2.5 py-1 ${d >= 45 && m.status === "new" ? "bg-red-500/15 text-red-500" : late ? "bg-amber-500/15 text-amber-500" : "bg-muted"}`}>
                    {m.status === "answered" ? tr("Answered") : d === 0 ? tr("Today") : tr("{d} day{v1} waiting", { d, v1: d === 1 ? "" : "s" })}
                  </span>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{tr(m.message)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" className="gap-1.5">
                  <a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to Kaizo")}`}><Mail className="h-4 w-4" />{" "}{tr("Reply by email")}</a>
                </Button>
                {m.status === "new" ? (
                  <Button size="sm" variant="outline" onClick={() => setStatus(m, "answered")} className="gap-1.5"><Check className="h-4 w-4" />{" "}{tr("Mark as answered")}</Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(m, "new")} className="gap-1.5"><RotateCcw className="h-4 w-4" />{" "}{tr("Reopen")}</Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {rows !== null && shown.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed py-16 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">{filter === "new" ? tr("Nothing is waiting. All answered.") : tr("No messages yet.")}</p>
        </div>
      )}
    </div>
  );
}
