import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-guard";
import { countCards, listDecks } from "@/lib/decks";
import { deckStats, getCardStates } from "@/lib/progress";
import { profileFromUser } from "@/lib/user";
import { AppHeader } from "@/components/AppHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { StatTile } from "@/components/StatTile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Öyrən" };

/**
 * Flashcards with spaced repetition. Each deck shows what is due today,
 * what is still new and how much has been learned; a session opens the
 * deck's queue.
 */
export default async function LearnPage() {
  const user = await requireUser("/learn");
  const profile = profileFromUser(user);
  const [decks, states] = await Promise.all([listDecks(), getCardStates(user.id)]);
  const now = new Date();
  const rows = decks.map((deck) => ({
    deck,
    stats: deckStats(deck.slug, deck.cards.map((c) => c.id), states, now),
  }));
  const totals = rows.reduce(
    (t, r) => ({
      due: t.due + r.stats.due,
      fresh: t.fresh + Math.min(r.stats.fresh, r.deck.newPerDay),
      learned: t.learned + r.stats.learned,
      reviewedToday: t.reviewedToday + r.stats.reviewedToday,
    }),
    { due: 0, fresh: 0, learned: 0, reviewedToday: 0 },
  );
  const totalCards = countCards(decks);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-16">
      <AppHeader name={profile.firstName} avatarUrl={profile.avatarUrl} />

      <header className="mb-10">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
          Xoş gəlmisiniz, {profile.firstName}
        </div>
        <h1 className="mt-3 text-[clamp(2rem,4vw,2.8rem)] font-semibold leading-tight tracking-[-0.02em] text-ink dark:text-brand-cream">
          Öyrən
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink/55 dark:text-white/55">
          Kartlar aralıqlı təkrar üsulu ilə göstərilir: yaxşı bildiyiniz kart
          gec, çətin gələn kart tez qayıdır. Hər gün bir neçə dəqiqə kifayətdir.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Bu gün təkrar"
          value={totals.due}
          tone={totals.due > 0 ? "negative" : "neutral"}
          sub={totals.due > 0 ? "vaxtı çatmış kart" : "hamısı vaxtındadır"}
        />
        <StatTile label="Yeni kartlar" value={totals.fresh} sub="bu gün üçün hazır" />
        <StatTile
          label="Öyrənilib"
          value={totals.learned}
          tone={totals.learned > 0 ? "positive" : "neutral"}
          sub={`${totalCards} kartdan`}
        />
        <StatTile label="Bu gün baxılıb" value={totals.reviewedToday} sub="kart" />
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
          Dəstlər
        </h2>
        {rows.length === 0 ? (
          <div className="glass p-8 text-sm text-ink/55 dark:text-white/55">
            Hələ heç bir dəst əlavə edilməyib.
          </div>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2">
            {rows.map(({ deck, stats }) => {
              const sessionSize = stats.due + Math.min(stats.fresh, deck.newPerDay);
              const label =
                stats.due > 0
                  ? `Təkrar edin · ${sessionSize}`
                  : stats.fresh > 0
                    ? `Yeni kartlar · ${sessionSize}`
                    : "Baxın";
              return (
                <li key={deck.slug} className="glass flex flex-col p-6">
                  <h3 className="text-lg font-semibold leading-snug text-ink dark:text-brand-cream">
                    {deck.title}
                  </h3>
                  {deck.description ? (
                    <p className="mt-2 text-sm leading-6 text-ink/55 dark:text-white/55">{deck.description}</p>
                  ) : null}
                  <div className="num mt-4 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em]">
                    <span className={`rounded-full border px-2 py-0.5 ${stats.due > 0 ? "border-brand-red/40 text-brand-red dark:border-red-400/50 dark:text-red-300" : "border-brand-wood-ring text-ink/45 dark:border-white/15 dark:text-white/45"}`}>
                      {stats.due} təkrar
                    </span>
                    <span className="rounded-full border border-brand-brass/40 px-2 py-0.5 text-brand-brass">
                      {stats.fresh} yeni
                    </span>
                    <span className="rounded-full border border-brand-wood-ring px-2 py-0.5 text-ink/45 dark:border-white/15 dark:text-white/45">
                      {stats.learned}/{stats.total} öyrənilib
                    </span>
                  </div>
                  <ProgressBar percent={stats.total ? Math.round((stats.learned / stats.total) * 100) : 0} className="mt-4" />
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <Link
                      href={`/learn/${deck.slug}`}
                      className="rounded-xl bg-brand-wood px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-cream shadow-glass-wood transition hover:-translate-y-0.5 hover:bg-brand-wood-deep"
                    >
                      {label}
                    </Link>
                    {deck.source ? (
                      <Link
                        href={deck.source.href}
                        className="text-[10px] uppercase tracking-[0.16em] text-ink/45 transition hover:text-brand-wood dark:text-white/45 dark:hover:text-brand-brass-soft"
                      >
                        {deck.source.label} →
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
