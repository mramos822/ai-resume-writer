"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A section that fades in when it scrolls into view. It is visible from the start (without JavaScript, or when the observer is not there,
 * nothing stays blank): only a section that is below the fold when the page loads is hidden, and shown as it comes into view.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"open" | "waiting" | "shown">("open");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // already in view when the page loads: it stays as it is, with no animation and no flash
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    setState("waiting");
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("shown");
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-500 ease-out motion-reduce:transition-none ${
        state === "waiting" ? "opacity-0 translate-y-5 motion-reduce:translate-y-0 motion-reduce:opacity-100" : "opacity-100 translate-y-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
