-- Spaced-repetition state, one row per (user, deck, card). Decks and cards
-- live in the repo under content/decks; only the schedule lives here.

create table if not exists public.card_reviews (
  user_id       uuid not null references auth.users (id) on delete cascade,
  deck_slug     text not null check (deck_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  card_id       text not null check (length(card_id) between 1 and 64),
  ease          numeric(4,2) not null default 2.5 check (ease >= 1.3),
  interval_days integer not null default 0 check (interval_days >= 0),
  repetitions   integer not null default 0 check (repetitions >= 0),
  lapses        integer not null default 0 check (lapses >= 0),
  reviews       integer not null default 0 check (reviews >= 0),
  last_rating   smallint check (last_rating between 1 and 4),
  due_at        timestamptz not null default now(),
  reviewed_at   timestamptz not null default now(),
  primary key (user_id, deck_slug, card_id)
);

create index if not exists card_reviews_user_due_idx
  on public.card_reviews (user_id, due_at);

alter table public.card_reviews enable row level security;

drop policy if exists "reviews select own" on public.card_reviews;
create policy "reviews select own"
  on public.card_reviews for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "reviews insert own" on public.card_reviews;
create policy "reviews insert own"
  on public.card_reviews for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "reviews update own" on public.card_reviews;
create policy "reviews update own"
  on public.card_reviews for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.card_reviews from anon;
grant select, insert, update on public.card_reviews to authenticated;
