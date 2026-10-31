"use client";

import { useEffect, useState } from "react";

// The gazette's light/dark switch, in its header. It flips the same `dark`
// class on <html> and the same saved "theme" as the guide's floating switch
// (components/ThemeToggle.tsx), so the choice holds across the whole site.
// Where the browser can, the change cross-fades instead of snapping.

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

export default function ThemeSwitch() {
  // null until mounted: the server doesn't know the theme.
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    const apply = () => {
      document.documentElement.classList.toggle("dark", next);
      setDark(next);
    };
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Storage blocked (private mode): the switch still works for this visit.
    }
    const doc = document as ViewTransitionDocument;
    if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      doc.startViewTransition(apply);
    } else {
      apply();
    }
  }

  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-silver hover:text-foreground hover:bg-veil/[0.08] transition-colors shrink-0"
    >
      {dark === null ? (
        <span className="w-4 h-4" aria-hidden />
      ) : dark ? (
        // Sun: shown at night, tap for day.
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2m0 15v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2.5 12h2m15 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // Moon: shown by day, tap for night.
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7Z" />
        </svg>
      )}
    </button>
  );
}
