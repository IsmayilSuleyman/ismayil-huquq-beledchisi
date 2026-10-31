-- Readers choose what the bell tells them about: new gazette issues, new
-- Constitutional Court summaries, new books. Every existing subscription
-- keeps getting everything. push_subscribe() takes the chosen topics (and
-- updates them for a browser that is already subscribed); push_topics()
-- returns a browser's own choice, the endpoint being the secret that
-- proves the subscription is its own.
--
-- push_sends, which made sure an issue was announced once, now records any
-- kind of notice: ('issue', '13'), ('summary', '1630'), ('book', <uuid>).

alter table public.push_subscriptions
  add column if not exists topics text[] not null default array['issues', 'summaries', 'books'];

alter table public.push_subscriptions drop constraint if exists push_subscriptions_topics_check;
alter table public.push_subscriptions add constraint push_subscriptions_topics_check
  check (cardinality(topics) >= 1 and topics <@ array['issues', 'summaries', 'books']);

drop function if exists public.push_subscribe(text, text, text);

create or replace function public.push_subscribe(
  endpoint text,
  p256dh text,
  auth text,
  topics text[] default array['issues', 'summaries', 'books']
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if length(endpoint) > 1000 or length(p256dh) > 200 or length(auth) > 100
     or endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com|push\.services\.mozilla\.com)/'
  then
    raise exception 'not a push subscription' using errcode = '22023';
  end if;
  if topics is null or cardinality(topics) = 0 then
    raise exception 'choose at least one topic' using errcode = '22023';
  end if;
  if not (topics <@ array['issues', 'summaries', 'books']) then
    raise exception 'unknown topic' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (endpoint, p256dh, auth, topics)
  values (push_subscribe.endpoint, push_subscribe.p256dh, push_subscribe.auth, push_subscribe.topics)
  on conflict on constraint push_subscriptions_pkey
  do update set p256dh = excluded.p256dh, auth = excluded.auth, topics = excluded.topics;
end;
$$;

create or replace function public.push_topics(endpoint text)
returns text[]
language sql
stable
security definer
set search_path to ''
as $$
  select s.topics from public.push_subscriptions s where s.endpoint = push_topics.endpoint;
$$;

revoke execute on function public.push_subscribe(text, text, text, text[]) from public;
revoke execute on function public.push_topics(text) from public;
grant execute on function public.push_subscribe(text, text, text, text[]) to anon, authenticated;
grant execute on function public.push_topics(text) to anon, authenticated;

alter table public.push_sends add column if not exists kind text not null default 'issue';
alter table public.push_sends add column if not exists ref text;
update public.push_sends set ref = issue_number::text where ref is null;
alter table public.push_sends alter column ref set not null;
alter table public.push_sends drop constraint if exists push_sends_pkey;
alter table public.push_sends add primary key (kind, ref);
alter table public.push_sends alter column issue_number drop not null;
alter table public.push_sends drop constraint if exists push_sends_kind_check;
alter table public.push_sends add constraint push_sends_kind_check
  check (kind in ('issue', 'summary', 'book'));
