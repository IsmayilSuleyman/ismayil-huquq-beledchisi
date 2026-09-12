"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/Wordmark";

const NAV = [
  { href: "/courses", label: "Kurslar" },
  { href: "/account", label: "Hesab" },
];

export function AppHeader({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
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
        <Link href="/courses" aria-label="Kurslara keçin" className="shrink-0">
          <Wordmark size="sm" />
        </Link>

        <nav className="hidden items-center gap-6 sm:flex" aria-label="Bölmələr">
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
          <Link
            href="/account"
            className="flex items-center gap-2"
            aria-label="Hesab səhifəsi"
          >
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
            <span className="hidden text-xs text-ink/55 dark:text-white/55 md:inline">
              {name}
            </span>
          </Link>
          <button
            onClick={onLogout}
            className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/55 transition hover:text-brand-wood dark:text-white/60 dark:hover:text-brand-brass-soft"
          >
            Çıxış
          </button>
        </div>
      </div>
    </m.header>
  );
}
