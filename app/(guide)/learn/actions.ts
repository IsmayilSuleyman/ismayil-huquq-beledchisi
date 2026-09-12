"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guard";
import { isSlug } from "@/lib/content";
import { getDeck } from "@/lib/decks";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isRating, newState, schedule, type CardState, type Rating } from "@/lib/srs";

export type ReviewResult = { ok: true; state: CardState } | { ok: false; message: string };

/**
 * Records one rating. The next state is computed here from the stored one,
 * so the schedule cannot be forged from the browser.
 */
export async function reviewCard(deckSlug: string, cardId: string, rating: Rating): Promise<ReviewResult> {
  const user = await requireUser();
  if (!isSlug(deckSlug) || typeof cardId !== "string" || !cardId || cardId.length > 64 || !isRating(rating)) {
    return { ok: false, message: "Kart tapılmadı." };
  }
  const deck = await getDeck(deckSlug);
  if (!deck || !deck.cards.some((c) => c.id === cardId)) {
    return { ok: false, message: "Kart tapılmadı." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Verilənlər bazası hazır deyil." };

  const { data: row, error: readError } = await supabase
    .from("card_reviews")
    .select("ease, interval_days, repetitions, lapses, reviews, due_at")
    .eq("user_id", user.id)
    .eq("deck_slug", deckSlug)
    .eq("card_id", cardId)
    .maybeSingle();
  if (readError) {
    console.error("card_reviews read failed:", readError);
    return { ok: false, message: "Nəticə yadda saxlanılmadı. Yenidən cəhd edin." };
  }

  const now = new Date();
  const current: CardState = row
    ? {
        ease: Number(row.ease),
        intervalDays: row.interval_days,
        repetitions: row.repetitions,
        lapses: row.lapses,
        reviews: row.reviews,
        dueAt: row.due_at,
      }
    : newState(now);
  const next = schedule(current, rating, now);

  const { error } = await supabase.from("card_reviews").upsert(
    {
      user_id: user.id,
      deck_slug: deckSlug,
      card_id: cardId,
      ease: next.ease,
      interval_days: next.intervalDays,
      repetitions: next.repetitions,
      lapses: next.lapses,
      reviews: next.reviews,
      last_rating: rating,
      due_at: next.dueAt,
      reviewed_at: now.toISOString(),
    },
    { onConflict: "user_id,deck_slug,card_id" },
  );
  if (error) {
    console.error("card_reviews write failed:", error);
    return { ok: false, message: "Nəticə yadda saxlanılmadı. Yenidən cəhd edin." };
  }

  // The session page is dynamic and keeps its own queue; refreshing it
  // mid-session would only swap the card list under the learner.
  revalidatePath("/learn");
  revalidatePath("/account");
  return { ok: true, state: next };
}
