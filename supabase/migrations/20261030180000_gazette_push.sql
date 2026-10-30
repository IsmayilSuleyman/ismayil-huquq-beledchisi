-- Browser push notifications for new gazette issues.
--
-- Readers subscribe from the bell in the gazette header; no account needed.
-- A subscription is the browser's push endpoint plus its two keys. The
-- endpoint is an unguessable URL issued by the browser's push service, so
-- knowing it is what proves the subscription is yours: subscribing and
-- unsubscribing go through the two functions below, and nobody else can
-- read the table except admins and the publisher, who send the notices.
--
-- push_config holds the VAPID key pair that signs the notices. An admin
-- creates it once from the admin desk (Settings → Notifications), which
-- generates the pair in the browser; the private key is never committed.
-- Admins and the publisher can read it; anyone can read the public half
-- through push_public_key(), which browsers need to subscribe.
--
-- push_sends records which issues were announced, so a notice goes out once.

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions read senders" on public.push_subscriptions;
create policy "push_subscriptions read senders"
  on public.push_subscriptions for select
  to authenticated
  using (public.is_admin() or public.is_publisher());

-- Senders drop subscriptions the push service reports as gone.
drop policy if exists "push_subscriptions delete senders" on public.push_subscriptions;
create policy "push_subscriptions delete senders"
  on public.push_subscriptions for delete
  to authenticated
  using (public.is_admin() or public.is_publisher());

-- Only real push services: the sender POSTs to these URLs, so an arbitrary
-- host here would make it call anywhere a visitor liked.
create or replace function public.push_subscribe(endpoint text, p256dh text, auth text)
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
  insert into public.push_subscriptions (endpoint, p256dh, auth)
  values (push_subscribe.endpoint, push_subscribe.p256dh, push_subscribe.auth)
  on conflict on constraint push_subscriptions_pkey
  do update set p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

create or replace function public.push_unsubscribe(endpoint text)
returns void
language sql
security definer
set search_path to ''
as $$
  delete from public.push_subscriptions s where s.endpoint = push_unsubscribe.endpoint;
$$;

revoke execute on function public.push_subscribe(text, text, text) from public;
revoke execute on function public.push_unsubscribe(text) from public;
grant execute on function public.push_subscribe(text, text, text) to anon, authenticated;
grant execute on function public.push_unsubscribe(text) to anon, authenticated;

create table if not exists public.push_config (
  id            int primary key default 1 check (id = 1),
  vapid_public  text not null,
  vapid_private text not null,
  subject       text not null
);

alter table public.push_config enable row level security;

drop policy if exists "push_config read senders" on public.push_config;
create policy "push_config read senders"
  on public.push_config for select
  to authenticated
  using (public.is_admin() or public.is_publisher());

drop policy if exists "push_config write admin" on public.push_config;
create policy "push_config write admin"
  on public.push_config for insert
  to authenticated
  with check (public.is_admin());

create or replace function public.push_public_key()
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select c.vapid_public from public.push_config c where c.id = 1;
$$;

revoke execute on function public.push_public_key() from public;
grant execute on function public.push_public_key() to anon, authenticated;

create table if not exists public.push_sends (
  issue_number int primary key,
  sent_at      timestamptz not null default now(),
  delivered    int not null default 0
);

alter table public.push_sends enable row level security;

drop policy if exists "push_sends read senders" on public.push_sends;
create policy "push_sends read senders"
  on public.push_sends for select
  to authenticated
  using (public.is_admin() or public.is_publisher());

drop policy if exists "push_sends write senders" on public.push_sends;
create policy "push_sends write senders"
  on public.push_sends for insert
  to authenticated
  with check (public.is_admin() or public.is_publisher());

drop policy if exists "push_sends update senders" on public.push_sends;
create policy "push_sends update senders"
  on public.push_sends for update
  to authenticated
  using (public.is_admin() or public.is_publisher());
