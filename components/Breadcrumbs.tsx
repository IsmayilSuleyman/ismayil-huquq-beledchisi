import Link from "next/link";

export type Crumb = { href?: string; label: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Naviqasiya yolu" className="mb-6 print:hidden">
      <ol className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-ink/45 dark:text-white/45">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden>/</span> : null}
            {item.href ? (
              <Link
                href={item.href}
                className="transition hover:text-brand-wood dark:hover:text-brand-brass-soft"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-ink/70 dark:text-white/70">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
