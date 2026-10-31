-- Summaries of Constitutional Court decisions, the gazette's third shelf
-- (/summaries). A daily Claude Routine (scripts/summaries/ROUTINE.md) reads
-- each new Plenum decision on constcourt.gov.az, picks the Court's own
-- positions in the way Elgun Jafarov's "new decision" emails did
-- (scripts/summaries/STYLE.md), lays them out as a Word file with the firm's
-- header and an "AI-generated" mark, and publishes it here as the publisher
-- account. The page renders `body` directly; the Word file is the download.
--
-- `body` is a JSON array of blocks: { heading?: string, bullets: [{ text,
-- sub?: string[] }] }. Text carries the inline marks **bold**, __underline__
-- and *italic* (lib/gazette/marks.ts). Everyone can read; the publisher and
-- admins add; only admins change or delete (admin desk → Summaries).

create table if not exists public.court_summaries (
  id              uuid primary key default gen_random_uuid(),
  -- The number in https://constcourt.gov.az/az/decision/<id>.
  decision_id     int not null unique check (decision_id > 0),
  decision_date   date not null,
  kind            text not null check (kind in ('qərar', 'qərardad')),
  -- The decision's own title, as the Court's site lists it (Azerbaijani).
  title           text not null check (length(title) between 1 and 600),
  -- The English topic line: the question the Court answered.
  topic           text not null check (length(topic) between 1 and 600),
  url             text not null check (length(url) <= 500),
  body            jsonb not null,
  docx_path       text not null,
  file_size_bytes bigint,
  published_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists court_summaries_decision_date_idx
  on public.court_summaries (decision_date desc);

alter table public.court_summaries enable row level security;

drop policy if exists "court_summaries readable by everyone" on public.court_summaries;
create policy "court_summaries readable by everyone"
  on public.court_summaries for select
  using (true);

drop policy if exists "court_summaries insert senders" on public.court_summaries;
create policy "court_summaries insert senders"
  on public.court_summaries for insert
  to authenticated
  with check (public.is_admin() or public.is_publisher());

drop policy if exists "court_summaries update admin" on public.court_summaries;
create policy "court_summaries update admin"
  on public.court_summaries for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "court_summaries delete admin" on public.court_summaries;
create policy "court_summaries delete admin"
  on public.court_summaries for delete
  to authenticated
  using (public.is_admin());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists court_summaries_touch_updated_at on public.court_summaries;
create trigger court_summaries_touch_updated_at
  before update on public.court_summaries
  for each row execute function public.touch_updated_at();
