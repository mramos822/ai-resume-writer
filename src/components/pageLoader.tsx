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
export default function PageLoader({ label = "Getting things ready…" }: { label?: string }) {
  // The loading screen is shown by several parts of the app one after another (session check, page load). Each new one
  // would start the scan from the top and the line would jump back. Starting every animation at the point of the cycle
  // the clock is at keeps the line moving without a break from one screen to the next.
  const phase = { animationDelay: `-${((Date.now() % 2800) / 1000).toFixed(3)}s` };
  return (
    <div
      role="status"
      aria-live="polite"
      suppressHydrationWarning
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-background text-foreground"
    >
      <div className="relative h-72 w-56">
        {/* the sheet fades out towards the bottom */}
        <div
          className="absolute inset-0 overflow-hidden rounded-lg bg-white shadow-2xl shadow-blue-900/15 ring-1 ring-black/10"
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
      </div>
      <p className="text-sm font-medium tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
