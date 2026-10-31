"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Omni Law Firm logo. One asset for both themes: /images/omni-logo.png is
 * the official artwork (navy block, white wordmark, grey "LAW FIRM") on a
 * transparent ground, so it sits on cream and on dark alike and nothing is
 * swapped when the theme changes. The mark always occupies the same box
 * (a fixed height and the artwork's own width), so the header never shifts;
 * the drawn fallback below fills that same box if the file is missing.
 */

/** The artwork's width ÷ height (800 × 427). */
const ASPECT = 800 / 427;

export default function Logo({
  size = "md",
  href = "/",
}: {
  size?: "sm" | "md" | "lg";
  href?: string | null;
}) {
  const [missing, setMissing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const height = { sm: 44, md: 58, lg: 90 }[size];
  const width = Math.round(height * ASPECT);

  // If the image already failed before React hydrated, onError never fires —
  // detect that case on mount so the styled fallback still takes over.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setMissing(true);
  }, []);

  // The drawn mark, scaled to the same box as the artwork.
  const drawn = (
    <span
      className="flex h-full w-full flex-col items-stretch justify-center leading-none select-none"
      style={{ fontSize: height * 0.34 }}
    >
      <span className="bg-omni text-white rounded-[3px] px-[0.55em] pt-[0.06em] pb-[0.3em] font-jost font-extralight lowercase text-[1.85em] leading-[1.05] tracking-[0.03em] text-center shadow-[0_4px_18px_-6px_rgba(29,66,135,0.9),inset_0_1px_0_rgba(255,255,255,0.18)]">
        omni<span className="sr-only"> law firm</span>
      </span>
      <span
        aria-hidden
        className="text-silver font-jost font-light uppercase text-[0.62em] mt-[0.5em] tracking-[0.62em] [text-indent:0.13em] whitespace-nowrap text-center"
      >
        Law Firm
      </span>
    </span>
  );

  const mark = (
    <span className="relative block shrink-0 select-none" style={{ height, width }} aria-hidden={!missing}>
      {missing ? (
        drawn
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src="/images/omni-logo.png"
          alt="Omni Law Firm"
          width={width}
          height={height}
          className="block h-full w-full object-contain"
          onError={() => setMissing(true)}
        />
      )}
    </span>
  );

  if (!href) return mark;
  return (
    <Link
      href={href}
      aria-label="Omni Law Firm — home"
      className="shrink-0 transition-opacity hover:opacity-85"
    >
      {mark}
    </Link>
  );
}
