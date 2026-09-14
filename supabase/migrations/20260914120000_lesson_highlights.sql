-- Highlights and notes a reader makes inside a lesson. The lesson text stays
-- in the repo; a row stores where the highlight sits in that text as a quote
-- anchor (the exact passage plus a little context on both sides) and the
-- character offsets seen when it was made. The offsets are a fast path; the
-- quote lets the browser find the passage again after small edits to the
-- lesson. A highlight may carry a note.

create table if not exists public.lesson_highlights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  course_slug  text not null check (course_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  lesson_slug  text not null check (lesson_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  exact        text not null check (length(exact) between 1 and 5000),
  prefix       text not null default '' check (length(prefix) <= 64),
  suffix       text not null default '' check (length(suffix) <= 64),
  start_offset integer not null check (start_offset >= 0),
  end_offset   integer not null check (end_offset > start_offset),
  color        text not null default 'yellow'
               check (color in ('yellow', 'green', 'blue', 'pink')),
  note         text not null default '' check (length(note) <= 4000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists lesson_highlights_user_lesson_idx
  on public.lesson_highlights (user_id, course_slug, lesson_slug, start_offset);

alter table public.lesson_highlights enable row level security;

drop policy if exists "highlights select own" on public.lesson_highlights;
create policy "highlights select own"
  on public.lesson_highlights for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "highlights insert own" on public.lesson_highlights;
create policy "highlights insert own"
  on public.lesson_highlights for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "highlights update own" on public.lesson_highlights;
create policy "highlights update own"
  on public.lesson_highlights for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "highlights delete own" on public.lesson_highlights;
create policy "highlights delete own"
  on public.lesson_highlights for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on public.lesson_highlights from anon;
grant select, insert, update, delete on public.lesson_highlights to authenticated;
