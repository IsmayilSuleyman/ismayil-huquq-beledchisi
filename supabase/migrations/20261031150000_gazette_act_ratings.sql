-- Readers rate how important an act is, one to five stars, from the note's
-- panel on the board; no account is needed, so a reader is a random token
-- the browser keeps (like the push subscriptions). One vote per reader per
-- act; voting again replaces it. The act row carries the running count and
-- sum, so the board reads them with the act: an act two or more readers
-- rate below 3.0 on average leaves the board (lib/gazette/acts.ts).
--
-- Votes are written only through rate_act(), which also keeps the totals;
-- the votes table itself has no policies for readers (admins may look).

alter table public.gazette_acts
  add column if not exists rating_count int not null default 0 check (rating_count >= 0),
  add column if not exists rating_sum   int not null default 0 check (rating_sum >= 0);

create table if not exists public.gazette_act_ratings (
  act_id     uuid not null references public.gazette_acts (id) on delete cascade,
  voter      text not null check (length(voter) between 16 and 64),
  stars      int  not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (act_id, voter)
);

alter table public.gazette_act_ratings enable row level security;

drop policy if exists "gazette_act_ratings select admin" on public.gazette_act_ratings;
create policy "gazette_act_ratings select admin"
  on public.gazette_act_ratings for select
  to authenticated
  using (public.is_admin());

drop policy if exists "gazette_act_ratings delete admin" on public.gazette_act_ratings;
create policy "gazette_act_ratings delete admin"
  on public.gazette_act_ratings for delete
  to authenticated
  using (public.is_admin());

-- Records or replaces one reader's vote and returns the act's new totals.
create or replace function public.rate_act(p_act uuid, p_voter text, p_stars int)
returns table (rating_count int, rating_sum int)
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'stars must be between 1 and 5';
  end if;
  if p_voter is null or length(p_voter) < 16 or length(p_voter) > 64 then
    raise exception 'bad voter token';
  end if;

  insert into public.gazette_act_ratings (act_id, voter, stars)
  values (p_act, p_voter, p_stars)
  on conflict (act_id, voter) do update
    set stars = excluded.stars, updated_at = now();

  update public.gazette_acts a
  set rating_count = t.c, rating_sum = t.s
  from (
    select count(*)::int as c, coalesce(sum(r.stars), 0)::int as s
    from public.gazette_act_ratings r
    where r.act_id = p_act
  ) t
  where a.id = p_act;

  return query
    select a.rating_count, a.rating_sum
    from public.gazette_acts a
    where a.id = p_act;
end;
$$;

revoke all on function public.rate_act(uuid, text, int) from public;
grant execute on function public.rate_act(uuid, text, int) to anon, authenticated;
