-- Readers suggest one act for the board: the + note on the board lists the
-- last month's acts the picks left out, and a reader pins one of them. No
-- account is needed; a reader is the same random browser token the star
-- ratings use. One suggestion per reader: suggesting another act moves it,
-- and suggesting nothing withdraws it. The act row carries the running
-- count, so the board reads it with the act and shows the most suggested
-- ones beside the picks (lib/gazette/acts.ts).
--
-- Suggestions are written only through suggest_act(), which also keeps the
-- counts; the table itself has no policies for readers (admins may look).

alter table public.gazette_acts
  add column if not exists suggestion_count int not null default 0 check (suggestion_count >= 0);

create table if not exists public.gazette_act_suggestions (
  voter      text primary key check (length(voter) between 16 and 64),
  act_id     uuid not null references public.gazette_acts (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gazette_act_suggestions_act_idx on public.gazette_act_suggestions (act_id);

alter table public.gazette_act_suggestions enable row level security;

drop policy if exists "gazette_act_suggestions select admin" on public.gazette_act_suggestions;
create policy "gazette_act_suggestions select admin"
  on public.gazette_act_suggestions for select
  to authenticated
  using (public.is_admin());

drop policy if exists "gazette_act_suggestions delete admin" on public.gazette_act_suggestions;
create policy "gazette_act_suggestions delete admin"
  on public.gazette_act_suggestions for delete
  to authenticated
  using (public.is_admin());

-- Sets (or, with a null act, withdraws) one reader's suggestion and returns
-- the new counts of every act it touched: the one it left and the one it
-- went to.
create or replace function public.suggest_act(p_act uuid, p_voter text)
returns table (id uuid, suggestion_count int)
language plpgsql
security definer
set search_path to ''
as $$
#variable_conflict use_column
declare
  v_old uuid;
begin
  if p_voter is null or length(p_voter) < 16 or length(p_voter) > 64 then
    raise exception 'bad voter token';
  end if;
  if p_act is not null and not exists (select 1 from public.gazette_acts a where a.id = p_act) then
    raise exception 'no such act';
  end if;

  select s.act_id into v_old from public.gazette_act_suggestions s where s.voter = p_voter;

  if p_act is null then
    delete from public.gazette_act_suggestions s where s.voter = p_voter;
  else
    insert into public.gazette_act_suggestions (voter, act_id)
    values (p_voter, p_act)
    on conflict (voter) do update
      set act_id = excluded.act_id, updated_at = now();
  end if;

  update public.gazette_acts a
  set suggestion_count = (
    select count(*)::int from public.gazette_act_suggestions s where s.act_id = a.id
  )
  where a.id in (v_old, p_act);

  return query
    select a.id, a.suggestion_count
    from public.gazette_acts a
    where a.id in (v_old, p_act);
end;
$$;

revoke all on function public.suggest_act(uuid, text) from public;
grant execute on function public.suggest_act(uuid, text) to anon, authenticated;
