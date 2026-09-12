"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GAZETTE_URL } from "@/lib/gazette";
import { Wordmark } from "@/components/Wordmark";
import { SectionMenu } from "@/components/SectionMenu";

/**
 * Sticky, edge-to-edge site header for the signed-in area: wordmark on the
 * left; on the right the switch pill to the gazette (mirroring the gazette's
 * own header), the section dropdown, the account link, a hairline, then the
 * account cluster. Without a `name` the cluster collapses to a sign-in link.
 */
/** Sign-out control for pages where the header hides it (phones). */
export function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const onLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };
  return (
    <button
      type="button"
      onClick={onLogout}
      className={`inline-flex items-center justify-center rounded-xl border border-brand-wood/30 px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-brand-wood transition hover:-translate-y-0.5 hover:bg-brand-wood-mist dark:border-brand-brass/40 dark:text-brand-brass-soft dark:hover:bg-white/10 ${className}`}
    >
      Çıxış
    </button>
  );
}

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
      className="sticky top-0 z-40 mb-12 w-screen border-b border-brand-wood/15 bg-white/55 backdrop-blur-md [margin-left:calc(50%-50vw)] dark:bg-white/5"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/courses" aria-label="Kurslara keçin" className="shrink-0">
          <Wordmark size="xs" className="sm:hidden" />
          <Wordmark size="sm" className="hidden sm:inline-flex" />
        </Link>

        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          {/* Sister-site switch pill, mirrored from the gazette header; phones use the Qəzet tab */}
          <a
            href={GAZETTE_URL}
            title="Omni Law Gazette"
            className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/55 transition hover:border-brand-brass/50 hover:bg-white/60 hover:text-brand-wood dark:border-white/15 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-brand-brass-soft sm:inline-flex"
          >
            Qəzetə keç
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>

          <nav className="flex items-center gap-1 sm:gap-3" aria-label="Bölmələr">
            <SectionMenu />
            <Link
              href="/account"
              aria-current={pathname.startsWith("/account") ? "page" : undefined}
              className={`hidden rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition hover:bg-white/60 dark:hover:bg-white/10 md:inline-flex ${
                pathname.startsWith("/account")
                  ? "text-brand-wood dark:text-brand-brass-soft"
                  : "text-ink/45 hover:text-brand-wood dark:text-white/50 dark:hover:text-brand-brass-soft"
              }`}
            >
              Hesab
            </Link>
          </nav>

          <span aria-hidden className="hidden h-5 w-px bg-ink/10 dark:bg-white/15 md:block" />

          {!name ? (
            <Link
              href={`/login?next=${encodeURIComponent(pathname)}`}
              className="rounded-lg bg-brand-wood px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-cream transition hover:-translate-y-px hover:bg-brand-wood-deep"
            >
              Daxil olun
            </Link>
          ) : (
            <div className="flex items-center gap-3 sm:gap-4">
              <Link href="/account" className="flex items-center gap-2" aria-label="Hesab səhifəsi">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 rounded-full border border-ink/10 object-cover dark:border-white/15"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-wood-mist text-xs font-semibold text-brand-wood dark:bg-white/10 dark:text-brand-brass-soft">
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden text-xs text-ink/60 dark:text-white/60 lg:inline">{name}</span>
              </Link>
              {/* On phones sign-out lives on the account page (Hesab tab). */}
              <button
                onClick={onLogout}
                className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45 transition hover:text-brand-wood dark:text-white/50 dark:hover:text-brand-brass-soft md:inline"
              >
                Çıxış
              </button>
            </div>
          )}
        </div>
      </div>
    </m.header>
  );
}
