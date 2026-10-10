import { readResumeCount } from "@/lib/resumeCounter";

// Public live feed of the resumes-created count (Server-Sent Events). Each open page gets the number right away and a new one
// the moment it changes. The server checks the counter every 2 seconds and only sends when it moved.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHECK_MS = 2000;
const MAX_LIFETIME_MS = 10 * 60 * 1000; // the browser reconnects by itself, so connections never pile up

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      let last = -1;
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        clearTimeout(closeTimer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const tick = async () => {
        if (closed) return;
        try {
          const n = await readResumeCount();
          if (n !== last) {
            last = n;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ resumes: n })}\n\n`));
          } else {
            controller.enqueue(encoder.encode(`: keep-alive\n\n`)); // keeps proxies from cutting a quiet connection
          }
        } catch {
          close();
        }
      };

      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      await tick();
      timer = setInterval(tick, CHECK_MS);
      closeTimer = setTimeout(close, MAX_LIFETIME_MS);
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      clearInterval(timer);
      clearTimeout(closeTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
