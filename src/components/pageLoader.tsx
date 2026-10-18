"use client";

import { motion } from "framer-motion";
import { useT } from "@/i18n/provider";

/** One sheet of a resume, drawn with bars. */
function Sheet({ lit = false }: { lit?: boolean }) {
  // grey sheet; the lit copy is the same sheet in blue and is only visible around the scanner line
  const c = lit
    ? { bar: "bg-blue-500", soft: "bg-blue-400", title: "bg-blue-700", head: "bg-blue-600", dot: "bg-blue-500", rule: "bg-blue-300" }
    : { bar: "bg-neutral-200", soft: "bg-neutral-300", title: "bg-neutral-700", head: "bg-neutral-400", dot: "bg-neutral-300", rule: "bg-neutral-200" };
  const row = (w: number, key: string) => <div key={key} className={`h-[5px] rounded-full ${c.bar}`} style={{ width: `${w}%` }} />;
  return (
    <div className="h-full w-full p-5">
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 shrink-0 rounded-full ${c.dot}`} />
        <div className="flex-1 space-y-2">
          <div className={`h-2.5 w-3/4 rounded-full ${c.title}`} />
          <div className={`h-[5px] w-1/2 rounded-full ${c.soft}`} />
        </div>
      </div>
      <div className={`mt-4 h-px w-full ${c.rule}`} />
      <div className="mt-4 space-y-[7px]">
        <div className={`h-[7px] w-1/3 rounded-full ${c.head}`} />
        {[96, 88, 70].map((w, i) => row(w, `a${i}`))}
      </div>
      <div className="mt-5 space-y-[7px]">
        <div className={`h-[7px] w-2/5 rounded-full ${c.head}`} />
        {[92, 84, 94, 58].map((w, i) => row(w, `b${i}`))}
      </div>
      <div className="mt-5 space-y-[7px]">
        <div className={`h-[7px] w-1/4 rounded-full ${c.head}`} />
        {[90, 66, 80].map((w, i) => row(w, `c${i}`))}
      </div>
    </div>
  );
}

/** The one loading screen of the app: a resume being scanned. Shown whenever a page (or the session) is still being prepared. */
export default function PageLoader({ label }: { label?: string }) {
  const { tr } = useT();
  // The loading screen is shown by several parts of the app one after another (session check, page load). Each new one
  // would start the scan from the top and the line would jump back. Starting every animation at the point of the cycle
  // the clock is at keeps the line moving without a break from one screen to the next.
  const phase = { animationDelay: `-${((Date.now() % 2800) / 1000).toFixed(3)}s` };
  return (
    // It enters with a short fade (a quick load never flashes it) and leaves by lifting away, so the page underneath appears smoothly.
    <motion.div
      role="status"
      aria-live="polite"
      suppressHydrationWarning
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.35, delay: 0.12, ease: "easeOut" } }}
      exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeInOut" } }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background text-foreground sm:gap-8"
    >
      {/* the sheet is drawn at its full size and scaled down on a phone (the margins give back the room the scale frees) */}
      <div className="max-sm:-my-10 max-sm:scale-[0.68]">
      <motion.div
        className="relative h-72 w-56"
        initial={{ opacity: 0, y: 14, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] } }}
        exit={{ opacity: 0, y: -18, scale: 1.04, filter: "blur(6px)", transition: { duration: 0.4, ease: "easeIn" } }}
      >
        {/* the sheet fades out towards the bottom */}
        <div
          className="absolute inset-0 overflow-hidden rounded-lg bg-white shadow-2xl shadow-slate-900/25 ring-1 ring-slate-900/15"
          style={{ WebkitMaskImage: "linear-gradient(to bottom, #000 45%, transparent 100%)", maskImage: "linear-gradient(to bottom, #000 45%, transparent 100%)" }}
        >
          <Sheet />
          {/* the lines under the scanner turn blue; as it moves away they go back to grey */}
          <div className="absolute inset-0 animate-scan-light" style={phase} suppressHydrationWarning>
            <Sheet lit />
          </div>
        </div>
        {/* a line that travels over the whole sheet, down and up */}
        <div className="pointer-events-none absolute -inset-x-3 top-0 h-0 animate-scan-bar" style={phase} suppressHydrationWarning>
          <div className="absolute inset-x-1 -top-20 h-20 bg-gradient-to-t from-blue-500/35 via-blue-500/10 to-transparent" />
          <div className="absolute inset-x-1 top-0 h-20 bg-gradient-to-b from-blue-500/35 via-blue-500/10 to-transparent" />
          <div className="absolute inset-x-0 -top-[2px] h-1 rounded-full bg-blue-500 shadow-[0_0_18px_5px_rgba(59,130,246,0.7)]" />
        </div>
      </motion.div>
      </div>
      <motion.p
        className="text-sm font-medium tracking-wide text-muted-foreground"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.45, delay: 0.3 } }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
      >
        {label ?? tr("Getting things ready…")}
      </motion.p>
    </motion.div>
  );
}
