import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { getDeck } from "@/lib/decks";
import { cardKey, getCardStates } from "@/lib/progress";
import type { CardState } from "@/lib/srs";
import { profileFromUser } from "@/lib/user";
import { AppHeader } from "@/components/AppHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FlashcardSession } from "@/components/FlashcardSession";

export const dynamic = "force-dynamic";

type Params = Promise<{ deck: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { deck: slug } = await params;
  const deck = await getDeck(slug);
  return { title: deck ? `${deck.title} · Öyrən` : "Dəst" };
}

/**
 * One review session: due cards first (oldest due first), then new cards in
 * deck order, capped by the deck's new-per-day limit minus the new cards
 * already started today.
 */
export default async function DeckPage({ params }: { params: Params }) {
  const { deck: slug } = await params;
  const user = await requireUser(`/learn/${slug}`);
  const profile = profileFromUser(user);
  const [deck, states] = await Promise.all([getDeck(slug), getCardStates(user.id)]);
  if (!deck) notFound();

  const now = Date.now();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const due = deck.cards
    .map((c) => ({ card: c, state: states.get(cardKey(deck.slug, c.id)) ?? null }))
    .filter((x) => x.state && new Date(x.state.dueAt).getTime() <= now)
    .sort((a, b) => new Date(a.state!.dueAt).getTime() - new Date(b.state!.dueAt).getTime())
    .map((x) => x.card);

  const startedToday = deck.cards.filter((c) => {
    const s = states.get(cardKey(deck.slug, c.id));
    return s && s.reviews === 1 && new Date(s.reviewedAt).getTime() >= dayStart.getTime();
  }).length;
  const fresh = deck.cards
    .filter((c) => !states.has(cardKey(deck.slug, c.id)))
    .slice(0, Math.max(0, deck.newPerDay - startedToday));

  const queue = [...due, ...fresh];
  const initialStates: Record<string, CardState> = {};
  for (const c of queue) {
    const s = states.get(cardKey(deck.slug, c.id));
    if (s) {
      initialStates[c.id] = {
        ease: s.ease,
        intervalDays: s.intervalDays,
        repetitions: s.repetitions,
        lapses: s.lapses,
        reviews: s.reviews,
        dueAt: s.dueAt,
      };
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-16">
      <AppHeader name={profile.firstName} avatarUrl={profile.avatarUrl} />
      <Breadcrumbs items={[{ href: "/learn", label: "Öyrən" }, { label: deck.title }]} />

      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-tight tracking-[-0.02em] text-ink dark:text-brand-cream">
            {deck.title}
          </h1>
          <p className="num mt-2 text-sm text-ink/55 dark:text-white/55">
            {due.length} təkrar · {fresh.length} yeni · {deck.cards.length} kart
          </p>
        </header>

        <FlashcardSession
          deckSlug={deck.slug}
          deckTitle={deck.title}
          cards={queue}
          initialStates={initialStates}
        />
      </div>
    </main>
  );
}
