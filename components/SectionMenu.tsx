"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/** The platform's sections, shown in the header dropdown and the tab bar. */
export const SECTIONS = [
  { href: "/learn", label: "Öyrən", hint: "Növbəti dərsiniz və nəticələriniz" },
  { href: "/courses", label: "Kurslar", hint: "Bütün kurslar və dərslər" },
  { href: "/resources", label: "Mənbələr", hint: "Qanunlar və hüquqi aktlar üzrə materiallar" },
] as const;

export function currentSection(pathname: string) {
  return SECTIONS.find((s) => pathname.startsWith(s.href)) ?? null;
}

/**
 * Header dropdown listing the sections. The trigger shows the section you
 * are in; the panel closes on outside click, Escape, or after choosing.
 */
export function SectionMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = currentSection(pathname);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition hover:bg-white/60 dark:hover:bg-white/10 ${
          current
            ? "text-brand-wood dark:text-brand-brass-soft"
            : "text-ink/55 dark:text-white/60"
        }`}
      >
        {current?.label ?? "Bölmələr"}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Bölmələr"
          className="glass-strong absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden p-1.5 shadow-glass-wood"
        >
          {SECTIONS.map((s) => {
            const active = current?.href === s.href;
            return (
              <Link
                key={s.href}
                href={s.href}
                role="menuitem"
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`block rounded-xl px-3.5 py-2.5 transition hover:bg-brand-wood-mist dark:hover:bg-white/10 ${
                  active ? "bg-brand-wood-mist/70 dark:bg-white/5" : ""
                }`}
              >
                <span
                  className={`block text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    active
                      ? "text-brand-wood dark:text-brand-brass-soft"
                      : "text-ink dark:text-brand-cream"
                  }`}
                >
                  {s.label}
                </span>
                <span className="mt-0.5 block text-xs text-ink/50 dark:text-white/50">{s.hint}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
