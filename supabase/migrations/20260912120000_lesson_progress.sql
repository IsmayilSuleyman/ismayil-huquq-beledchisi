-- Per-user lesson completion. One row per (user, course, lesson); the row's
-- presence means "completed". Course and lesson slugs mirror the folder and
-- file names under content/courses, so content stays file-based and only
-- progress lives in the database.

create table if not exists public.lesson_progress (
  user_id      uuid not null references auth.users (id) on delete cascade,
  course_slug  text not null check (course_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  lesson_slug  text not null check (lesson_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  completed_at timestamptz not null default now(),
  primary key (user_id, course_slug, lesson_slug)
);

create index if not exists lesson_progress_user_idx
  on public.lesson_progress (user_id);

alter table public.lesson_progress enable row level security;

-- Each person reads and writes only their own rows.
drop policy if exists "progress select own" on public.lesson_progress;
create policy "progress select own"
  on public.lesson_progress for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "progress insert own" on public.lesson_progress;
create policy "progress insert own"
  on public.lesson_progress for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "progress delete own" on public.lesson_progress;
create policy "progress delete own"
  on public.lesson_progress for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on public.lesson_progress from anon;
grant select, insert, delete on public.lesson_progress to authenticated;
