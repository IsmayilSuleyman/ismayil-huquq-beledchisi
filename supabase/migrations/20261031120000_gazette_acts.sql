-- The acts of every gazette issue as rows of their own, so the site can
-- show them one by one (the board on the landing page) rather than only
-- inside the issue's PDF. The publisher (scripts/gazette/publish.mts)
-- inserts them right after the issue row; `npm run gazette:acts` loads them
-- for an issue published without. Everyone can read them; the publisher
-- and admins can add them; only admins can correct or remove them.
--
-- `topics` and `important` are decided by rule when the rows are written
-- (lib/gazette/acts.ts): every Constitutional Court ruling, and every act
-- touching corporate, banking, tax, civil, criminal or administrative law,
-- is important and goes on the board.

create table if not exists public.gazette_acts (
  id           uuid primary key default gen_random_uuid(),
  issue_number int not null check (issue_number > 0),
  position     int not null check (position > 0),
  section      text not null check (section in ('decrees', 'decisions', 'bills', 'court')),
  number       text check (length(number) <= 40),
  date         date not null,
  text         text not null check (length(text) between 1 and 400),
  url          text not null check (url ~ '^https?://'),
  stage        text check (stage in ('I', 'II', 'III')),
  ruling       text check (ruling in ('qərar', 'qərardad')),
  topics       text[] not null default '{}',
  important    boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (issue_number, position)
);

create index if not exists gazette_acts_date_idx on public.gazette_acts (date desc);

alter table public.gazette_acts enable row level security;

drop policy if exists "gazette_acts readable by everyone" on public.gazette_acts;
create policy "gazette_acts readable by everyone"
  on public.gazette_acts for select
  using (true);

drop policy if exists "gazette_acts insert publisher or admin" on public.gazette_acts;
create policy "gazette_acts insert publisher or admin"
  on public.gazette_acts for insert
  to authenticated
  with check (public.is_publisher() or public.is_admin());

drop policy if exists "gazette_acts update admin" on public.gazette_acts;
create policy "gazette_acts update admin"
  on public.gazette_acts for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "gazette_acts delete admin" on public.gazette_acts;
create policy "gazette_acts delete admin"
  on public.gazette_acts for delete
  to authenticated
  using (public.is_admin());
