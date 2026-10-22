"use client";

import React, { useState } from "react";

/** "Lentech Inc." becomes "lentech": the company name without legal endings, to guess its website. */
function domainGuess(company: string): string {
  const slug = company
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(inc|llc|ltd|limited|gmbh|corp|corporation|co|company|ag|sa|plc|pllc|lp|llp|holdings|technologies|technology|group)\b\.?/g, " ")
    .replace(/[^a-z0-9]/g, "");
  return slug.length >= 3 ? `${slug}.com` : "";
}

/** A made-up logo for a company with none: its initials on a gradient whose color comes from the name (same name, same logo). */
function GeneratedLogo({ company, size }: { company: string; size: number }) {
  const clean = company.replace(/\(.*?\)/g, " ").replace(/(inc|llc|ltd|gmbh|corp|co|plc)\.?/gi, " ").trim();
  const parts = clean.split(/[\s\-_/&,.]+/).filter(Boolean);
  const initials = (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
  let h = 0;
  for (const ch of company) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      className="flex h-full w-full items-center justify-center font-extrabold tracking-tight text-white"
      style={{ background: `linear-gradient(135deg, hsl(${h} 70% 52%), hsl(${(h + 40) % 360} 75% 38%))`, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}

/**
 * The company's logo: the one the job board gives, else the icon of its website (guessed from its name; it comes through /api/logo, which never
 * answers an error), else a logo
 * made for it. A tiny image (16 px) is the generic icon the icon service gives to sites without one, so it is skipped.
 */
export default function CompanyLogo({ company, logo, size = 48 }: { company: string; logo?: string; size?: number }) {
  const guess = domainGuess(company);
  const sources = [logo, guess ? `/api/logo?d=${guess}` : ""].filter(Boolean) as string[];
  const [stage, setStage] = useState(0);
  const src = sources[stage];
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white" style={{ width: size, height: size }} aria-hidden>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth < 32) setStage((st) => st + 1);
          }}
          onError={() => setStage((st) => st + 1)}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <GeneratedLogo company={company} size={size} />
      )}
    </span>
  );
}
