"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// "Library ▾" in the gazette header: opens a short list of the two shelves.
const SHELVES = [
  { href: "/", label: "Gazette", hint: "Weekly legislature digest", active: (p: string) => p === "/" || p.startsWith("/issues") },
  { href: "/books", label: "Books", hint: "Legal texts and references", active: (p: string) => p.startsWith("/books") },
];

export default function LibraryMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors ${
          open ? "text-foreground bg-veil/[0.08]" : "text-foreground/85 hover:text-foreground hover:bg-veil/[0.08]"
        }`}
      >
        Library
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 olg-glass-deep rounded-xl p-1.5 z-50 olg-rise"
        >
          {SHELVES.map((s) => {
            const current = s.active(pathname);
            return (
              <Link
                key={s.href}
                href={s.href}
                role="menuitem"
                aria-current={current ? "page" : undefined}
                className={`block rounded-lg px-3.5 py-2.5 transition-colors ${
                  current ? "bg-omni/50 text-white" : "hover:bg-veil/[0.07]"
                }`}
              >
                <span className="block text-sm">{s.label}</span>
                <span className="block text-[0.7rem] text-silver mt-0.5">{s.hint}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
