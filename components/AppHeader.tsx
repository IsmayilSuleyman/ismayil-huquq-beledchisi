"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GAZETTE_URL } from "@/lib/gazette";
import { Wordmark } from "@/components/Wordmark";
import { OmniMark } from "@/components/gazette/OmniLogo";

const NAV = [
  { href: "/courses", label: "Kurslar" },
  { href: "/account", label: "Hesab" },
];

/**
 * Sticky site header for the signed-in area. The pill next to the wordmark
 * switches to the gazette site — the same pattern as the İRF ↔ İsmayılBank
 * switch on the fund portal. Without a `name` the account cluster collapses
 * to a sign-in link.
 */
export function AppHeader({
  name,
  avatarUrl,
}: {
  name?: string;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createSupabaseBrowserClient();

  const onLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/login");
    router.refresh();
  };

  return (
    <m.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-40 -mx-6 mb-12 border-b border-brand-wood/15 bg-white/55 px-6 backdrop-blur-md dark:bg-white/5"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link href="/courses" aria-label="Kurslara keçin" className="shrink-0">
            <Wordmark size="sm" />
          </Link>

          {/* Sister-site switch pill */}
          <a
            href={GAZETTE_URL}
            aria-label="Omni Law Gazette-ə keç"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-ink/10 bg-white/80 px-3 py-2 transition hover:-translate-y-px hover:border-brand-brass/50 hover:shadow-sm dark:border-white/15 dark:bg-white/10"
          >
            <OmniMark size={22} />
            <span className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/55 dark:text-white/60 sm:inline">
              Qəzetə keç
            </span>
          </a>
        </div>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Bölmələr">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
                  active
                    ? "text-brand-wood dark:text-brand-brass-soft"
                    : "text-ink/45 hover:text-brand-wood dark:text-white/50 dark:hover:text-brand-brass-soft"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          {!name ? (
            <Link
              href={`/login?next=${encodeURIComponent(pathname)}`}
              className="rounded-lg bg-brand-wood px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-cream transition hover:-translate-y-px hover:bg-brand-wood-deep"
            >
              Daxil olun
            </Link>
          ) : (
            <>
              <Link href="/account" className="flex items-center gap-2" aria-label="Hesab səhifəsi">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full border border-ink/10 object-cover dark:border-white/15"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-wood-mist text-xs font-semibold text-brand-wood dark:bg-white/10 dark:text-brand-brass-soft">
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden text-xs text-ink/55 dark:text-white/55 lg:inline">{name}</span>
              </Link>
              <button
                onClick={onLogout}
                className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/55 transition hover:text-brand-wood dark:text-white/60 dark:hover:text-brand-brass-soft"
              >
                Çıxış
              </button>
            </>
          )}
        </div>
      </div>
    </m.header>
  );
}
