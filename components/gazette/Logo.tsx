"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Omni Law Firm logo. Renders the official asset (/public/omni-logo.png)
 * and falls back to a styled recreation until that file is added.
 */
export default function Logo({
  size = "md",
  href = "/gazette",
}: {
  size?: "sm" | "md" | "lg";
  href?: string | null;
}) {
  const [missing, setMissing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const heights = { sm: 44, md: 58, lg: 90 };

  // If the image already failed before React hydrated, onError never fires —
  // detect that case on mount so the styled fallback still takes over.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setMissing(true);
  }, []);
  const scale = { sm: "text-[15px]", md: "text-[19px]", lg: "text-[30px]" }[size];

  const mark = missing ? (
    <span className={`inline-flex flex-col items-stretch leading-none select-none ${scale}`}>
      <span className="bg-omni text-white rounded-[3px] px-[0.55em] pt-[0.06em] pb-[0.3em] font-jost font-extralight lowercase text-[1.85em] leading-[1.05] tracking-[0.03em] shadow-[0_4px_18px_-6px_rgba(29,66,135,0.9),inset_0_1px_0_rgba(255,255,255,0.18)]">
        omni<span className="sr-only"> law firm</span>
      </span>
      <span
        aria-hidden
        className="text-silver font-jost font-light uppercase text-[0.62em] mt-[0.5em] tracking-[0.62em] [text-indent:0.13em] whitespace-nowrap text-center"
      >
        Law Firm
      </span>
    </span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src="/images/omni-logo.png"
      alt="Omni Law Firm"
      style={{ height: heights[size], width: "auto" }}
      className="select-none object-contain"
      onError={() => setMissing(true)}
    />
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
