-- The automated gazette (a weekly Claude Routine, see
-- scripts/gazette/ROUTINE.md) signs in as a dedicated publisher account.
-- It may add issues and upload their files, and nothing else: it cannot
-- edit or delete issues, touch comments, or read or change the admin list.
-- It may delete only objects it uploaded within the last hour, so a failed
-- run can clean up after itself without being able to remove the files of
-- issues that are already live.
--
-- Publishers are listed here by email, like admins in admin_emails. The
-- table has no policies: it is managed from the SQL editor only.

create table if not exists public.publisher_emails (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

alter table public.publisher_emails enable row level security;

create or replace function public.is_publisher()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.publisher_emails p
    where p.email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
$$;

drop policy if exists "issues insert publisher" on public.issues;
create policy "issues insert publisher"
  on public.issues for insert
  to authenticated
  with check (public.is_publisher());

drop policy if exists "gazette publisher insert" on storage.objects;
create policy "gazette publisher insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'gazette' and public.is_publisher());

-- Removing an object needs it to be visible as well as deletable.
drop policy if exists "gazette publisher read recent own" on storage.objects;
create policy "gazette publisher read recent own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'gazette'
    and public.is_publisher()
    and owner_id = (select auth.uid())::text
    and created_at > now() - interval '1 hour'
  );

drop policy if exists "gazette publisher delete recent own" on storage.objects;
create policy "gazette publisher delete recent own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'gazette'
    and public.is_publisher()
    and owner_id = (select auth.uid())::text
    and created_at > now() - interval '1 hour'
  );
