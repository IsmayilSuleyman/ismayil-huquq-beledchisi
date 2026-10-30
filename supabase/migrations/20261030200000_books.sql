-- The gazette's second library: books, uploaded as PDFs from the admin desk
-- (Books tab) and read at /books. Files live in the public `gazette` bucket
-- under books/ and books/covers/, where the existing admin storage policies
-- already apply. Everyone can read the list; only admins can change it.

create table if not exists public.books (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(title) between 1 and 300),
  author          text check (length(author) <= 200),
  description     text check (length(description) <= 4000),
  year            int check (year between 1 and 3000),
  tags            text[] not null default '{}',
  pdf_path        text not null,
  cover_path      text,
  page_count      int,
  file_size_bytes bigint,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.books enable row level security;

drop policy if exists "books readable by everyone" on public.books;
create policy "books readable by everyone"
  on public.books for select
  using (true);

drop policy if exists "books insert admin" on public.books;
create policy "books insert admin"
  on public.books for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "books update admin" on public.books;
create policy "books update admin"
  on public.books for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "books delete admin" on public.books;
create policy "books delete admin"
  on public.books for delete
  to authenticated
  using (public.is_admin());

create or replace function public.books_touch_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists books_touch_updated_at on public.books;
create trigger books_touch_updated_at
  before update on public.books
  for each row execute function public.books_touch_updated_at();
