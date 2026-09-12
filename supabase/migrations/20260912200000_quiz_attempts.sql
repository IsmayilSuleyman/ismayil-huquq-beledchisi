-- Per-user test attempts. Every submission is kept so the account page can
-- show the best score and the number of tries; the questions themselves stay
-- in the repo under content/courses/<course>/quizzes.

create table if not exists public.quiz_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  course_slug text not null check (course_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  lesson_slug text not null check (lesson_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  score       integer not null check (score >= 0),
  total       integer not null check (total > 0 and score <= total),
  passed      boolean not null default false,
  answers     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists quiz_attempts_user_lesson_idx
  on public.quiz_attempts (user_id, course_slug, lesson_slug);

alter table public.quiz_attempts enable row level security;

drop policy if exists "attempts select own" on public.quiz_attempts;
create policy "attempts select own"
  on public.quiz_attempts for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "attempts insert own" on public.quiz_attempts;
create policy "attempts insert own"
  on public.quiz_attempts for insert
  to authenticated
  with check (user_id = auth.uid());

revoke all on public.quiz_attempts from anon;
grant select, insert on public.quiz_attempts to authenticated;
