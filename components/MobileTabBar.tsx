"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GAZETTE_URL } from "@/lib/gazette";

// Bottom tab bar shown on phones (hidden ≥sm) for the signed-in area.
// Rendered once in the root layout; hides itself on public pages
// (landing/login) where the page's own buttons cover navigation.

export function isAppRoute(pathname: string): boolean {
  return ["/courses", "/account"].some((p) => pathname.startsWith(p));
}

const TABS = [
  {
    href: "/courses",
    label: "Kurslar",
    isActive: (p: string) => p.startsWith("/courses"),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
        <path d="M4 20.5V5.5" />
        <path d="M8 7h8M8 11h8" />
      </svg>
    ),
  },
  {
    href: GAZETTE_URL,
    label: "Qəzet",
    isActive: () => false,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z" />
        <path d="M17 8h3v10a2 2 0 0 1-2 2" />
        <path d="M7 8h6M7 12h6M7 16h4" />
      </svg>
    ),
  },
  {
    href: "/account",
    label: "Hesab",
    isActive: (p: string) => p.startsWith("/account"),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
];

export function MobileTabBar() {
  const pathname = usePathname();
  if (!isAppRoute(pathname)) return null;

  return (
    <>
      {/* In-flow spacer so page content can scroll clear of the fixed bar. */}
      <div aria-hidden className="h-20 sm:hidden" />
      <nav
        aria-label="Əsas naviqasiya"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-white/15 dark:bg-black/60 sm:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {TABS.map((tab) => {
            const current = tab.isActive(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                  current
                    ? "text-brand-wood dark:text-brand-brass-soft"
                    : "text-ink/45 dark:text-white/50"
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
