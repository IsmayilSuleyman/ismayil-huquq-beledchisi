import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-guard";
import { groupByKind, listSources } from "@/lib/sources";
import { profileFromUser } from "@/lib/user";
import { GAZETTE_URL } from "@/lib/gazette";
import { AppHeader } from "@/components/AppHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mənbələr" };

const OFFICIAL = [
  { title: "e-qanun.az", href: "https://e-qanun.az/", text: "Hüquqi Aktların Vahid İnternet Elektron Bazası: aktların rəsmi, qüvvədə olan mətnləri." },
  { title: "president.az", href: "https://president.az/", text: "Fərmanlar, sərəncamlar və imzalanmış qanunlar." },
  { title: "meclis.gov.az", href: "https://meclis.gov.az/", text: "Milli Məclis: qanun layihələri və qəbul edilmiş qanunlar." },
  { title: "nk.gov.az", href: "https://nk.gov.az/", text: "Nazirlər Kabinetinin qərarları və sərəncamları." },
  { title: "constcourt.gov.az", href: "https://constcourt.gov.az/", text: "Konstitusiya Məhkəməsi Plenumunun qərarları." },
  { title: "Omni Law Gazette", href: GAZETTE_URL, text: "Qanunvericilikdəki dəyişikliklərin həftəlik icmalı." },
];

/**
 * Library of laws and legal acts, each with its own study material. Grouped
 * by kind (Konstitusiya, Məcəllə, Qanun ...); the official sources the
 * materials cite are listed at the end.
 */
export default async function ResourcesPage() {
  const user = await requireUser("/resources");
  const profile = profileFromUser(user);
  const sources = await listSources();
  const groups = groupByKind(sources);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-16">
      <AppHeader name={profile.firstName} avatarUrl={profile.avatarUrl} />

      <header className="mb-10">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
          Qanunlar və hüquqi aktlar
        </div>
        <h1 className="mt-3 text-[clamp(2rem,4vw,2.8rem)] font-semibold leading-tight tracking-[-0.02em] text-ink dark:text-brand-cream">
          Mənbələr
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink/55 dark:text-white/55">
          Hər akt üzrə tədris materialı: quruluşu, əsas prinsipləri, diqqət
          yetirilməli maddələr və oxu tövsiyələri. Rəsmi mətnə keçid hər
          materialın başındadır.
        </p>
      </header>

      {groups.length === 0 ? (
        <div className="glass p-8 text-sm text-ink/55 dark:text-white/55">
          Hələ heç bir material əlavə edilməyib.
        </div>
      ) : (
        <div className="space-y-12">
          {groups.map((group) => (
            <section key={group.kind}>
              <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
                {group.kind}
              </h2>
              <ul className="grid gap-5 md:grid-cols-2">
                {group.items.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/resources/${s.slug}`}
                      className="glass group flex h-full flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-glass-wood"
                    >
                      <span className="text-lg font-semibold leading-snug text-ink transition group-hover:text-brand-wood dark:text-brand-cream dark:group-hover:text-brand-brass-soft">
                        {s.title}
                      </span>
                      {s.summary ? (
                        <span className="mt-2 block flex-1 text-sm leading-6 text-ink/55 dark:text-white/55">
                          {s.summary}
                        </span>
                      ) : null}
                      <span className="num mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.18em] text-ink/40 dark:text-white/40">
                        {s.number ? <span>№ {s.number}</span> : null}
                        {s.adopted ? <span>{s.adopted}</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section className="mt-14">
        <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
          Rəsmi mənbələr
        </h2>
        <ul className="glass divide-y divide-brand-wood-ring/60 dark:divide-white/10">
          {OFFICIAL.map((o) => {
            const external = o.href.startsWith("http");
            return (
              <li key={o.href}>
                <a
                  href={o.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className="group flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/40 dark:hover:bg-white/5 sm:px-6"
                >
                  <span>
                    <span className="block text-sm font-semibold text-ink transition group-hover:text-brand-wood dark:text-brand-cream dark:group-hover:text-brand-brass-soft">
                      {o.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-ink/50 dark:text-white/50">{o.text}</span>
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-ink/35 dark:text-white/40">
                    <path d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
