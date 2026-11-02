-- The provisions a "Nə dəyişib?" paragraph cites, with their wording as
-- the act or bill gives it: a new article in full, an article given a new
-- edition, or the words replaced (old and new). The routine extracts them
-- from the act's text on the issuing body's site (ROUTINE.md step 3a.6;
-- the draft's `provisions`); the publisher writes them right after the act
-- rows. The board's panel turns each reference in the paragraph into a
-- link that opens the text. They are never printed in the issue. Readers
-- can read them; the publisher and admins add them; admins correct them.

create table if not exists public.gazette_act_provisions (
  id         uuid primary key default gen_random_uuid(),
  act_id     uuid not null references public.gazette_acts (id) on delete cascade,
  position   int not null check (position > 0),
  ref        text not null check (length(ref) between 1 and 60),
  act_name   text check (length(act_name) <= 200),
  kind       text check (kind in ('new', 'edition', 'replacement')),
  text       text not null check (length(text) between 1 and 6000),
  old_text   text check (length(old_text) <= 6000),
  created_at timestamptz not null default now(),
  unique (act_id, position)
);

create index if not exists gazette_act_provisions_act_idx on public.gazette_act_provisions (act_id);

alter table public.gazette_act_provisions enable row level security;

drop policy if exists "gazette_act_provisions readable by everyone" on public.gazette_act_provisions;
create policy "gazette_act_provisions readable by everyone"
  on public.gazette_act_provisions for select
  using (true);

drop policy if exists "gazette_act_provisions insert publisher or admin" on public.gazette_act_provisions;
create policy "gazette_act_provisions insert publisher or admin"
  on public.gazette_act_provisions for insert
  to authenticated
  with check (public.is_publisher() or public.is_admin());

drop policy if exists "gazette_act_provisions update admin" on public.gazette_act_provisions;
create policy "gazette_act_provisions update admin"
  on public.gazette_act_provisions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "gazette_act_provisions delete admin" on public.gazette_act_provisions;
create policy "gazette_act_provisions delete admin"
  on public.gazette_act_provisions for delete
  to authenticated
  using (public.is_admin());
