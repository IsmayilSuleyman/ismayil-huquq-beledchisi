import Link from "next/link";
import LibraryMenu from "@/components/gazette/LibraryMenu";
import Logo from "@/components/gazette/Logo";
import NotifyButton from "@/components/gazette/NotifyButton";
import ThemeSwitch from "@/components/gazette/ThemeSwitch";

// The guide's home page; the icon beside Admin switches over, like
// the İRF ↔ İsmayılBank switch on the fund portal.
const GUIDE_URL = "/beledci";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 olg-glass-deep border-x-0 border-t-0 rounded-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[68px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <Logo size="sm" />
          <span aria-hidden className="h-8 w-px bg-veil/[0.12] hidden sm:block" />
          <Link href="/" className="min-w-0 group">
            <span className="block font-serif text-base sm:text-[1.35rem] leading-tight tracking-tight text-foreground group-hover:text-azure-soft transition-colors truncate">
              Law&nbsp;Gazette
            </span>
            <span className="hidden sm:block text-[0.62rem] tracking-[0.28em] uppercase text-silver -mt-0.5 truncate">
              Weekly legislature digest
            </span>
          </Link>
        </div>
        <nav className="flex items-center gap-1.5 sm:gap-2 text-sm">
          <NotifyButton />
          <ThemeSwitch />
          <LibraryMenu />
          {/* Admin and the switch to the guide share one pill; phones show only the switch. */}
          <div className="inline-flex items-center rounded-lg border border-veil/[0.12] bg-veil/5 shrink-0 overflow-hidden">
            <Link
              href="/admin"
              className="hidden sm:inline-flex h-9 px-3.5 text-silver hover:text-foreground hover:bg-veil/[0.08] transition-colors items-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M16 8a4 4 0 1 0-7.6 1.7L3 15v3a1 1 0 0 0 1 1h3l1-1v-2h2l1-1v-2h2l.7-.7A4 4 0 1 0 16 8Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <circle cx="16.5" cy="7.5" r="1.3" fill="currentColor" />
              </svg>
              Admin
            </Link>
            <span aria-hidden className="hidden sm:block w-px h-5 bg-veil/[0.12]" />
            <a
              href={GUIDE_URL}
              title="İsmayıl Hüquq Bələdçisi"
              aria-label="İsmayıl Hüquq Bələdçisinə keç"
              className="inline-flex items-center justify-center w-9 h-9 hover:bg-veil/10 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/ihb-mark.svg" alt="" width={18} height={18} />
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
