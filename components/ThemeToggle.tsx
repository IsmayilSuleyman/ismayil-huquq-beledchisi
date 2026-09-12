"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isAppRoute } from "@/components/MobileTabBar";

// Floating light/dark switch, rendered once in the root layout so every
// page (including the public landing/login pages) gets it. The initial
// theme is applied before paint by the inline script in app/layout.tsx;
// this button just flips the class and persists the choice.

export function ThemeToggle() {
  // On app routes the mobile tab bar occupies the bottom edge — float the
  // toggle above it on phones (sm+ keeps the corner position).
  const pathname = usePathname();
  const lifted = isAppRoute(pathname);

  // null until mounted so the icon never disagrees with the real class
  // (the server doesn't know the theme).
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private-mode storage failures just mean the choice isn't persisted.
    }
    setDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "İşıqlı mövzuya keçin" : "Qaranlıq mövzuya keçin"}
      className={`fixed right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-white/80 text-ink/55 shadow-glass backdrop-blur-md transition hover:-translate-y-0.5 hover:text-ink/85 dark:border-white/15 dark:bg-white/10 dark:text-white/65 dark:hover:text-white/90 ${
        lifted ? "bottom-[5.5rem] sm:bottom-5" : "bottom-5"
      }`}
    >
      {dark === null ? null : dark ? (
        // Sun — shown in dark mode (tap to go light)
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon — shown in light mode (tap to go dark)
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
