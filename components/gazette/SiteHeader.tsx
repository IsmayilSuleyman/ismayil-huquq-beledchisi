import Link from "next/link";
import Logo from "@/components/gazette/Logo";

// The guide's home page; the pill next to the masthead switches over, like
// the İRF ↔ İsmayılBank switch on the fund portal.
const GUIDE_URL = "/";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 olg-glass-deep border-x-0 border-t-0 rounded-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[68px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <Logo size="sm" />
          <span aria-hidden className="h-8 w-px bg-white/[0.12] hidden sm:block" />
          <Link href="/gazette" className="min-w-0 group">
            <span className="block font-serif text-base sm:text-[1.35rem] leading-tight tracking-tight text-foreground group-hover:text-azure-soft transition-colors truncate">
              Law&nbsp;Gazette
            </span>
            <span className="hidden sm:block text-[0.62rem] tracking-[0.28em] uppercase text-silver -mt-0.5 truncate">
              Weekly legislature digest
            </span>
          </Link>
        </div>
        <nav className="flex items-center gap-1.5 sm:gap-2 text-sm">
          <a
            href={GUIDE_URL}
            title="İsmayıl Hüquq Bələdçisi"
            aria-label="İsmayıl Hüquq Bələdçisinə keç"
            className="inline-flex items-center gap-2 px-3 py-2 mr-1 sm:mr-2 rounded-lg border border-white/[0.12] bg-white/5 hover:bg-white/10 hover:border-azure/40 transition-colors shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/ihb-mark.svg" alt="" width={18} height={18} />
            <span className="hidden sm:inline text-[0.62rem] uppercase tracking-[0.2em] text-silver">
              Bələdçiyə keç
            </span>
          </a>
          <Link
            href="/gazette"
            className="px-3.5 py-2 rounded-lg text-foreground/85 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            Library
          </Link>
          <Link
            href="/gazette/admin"
            className="hidden sm:inline-flex px-3.5 py-2 rounded-lg text-silver hover:text-white hover:bg-white/[0.08] transition-colors items-center gap-1.5"
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
        </nav>
      </div>
    </header>
  );
}
