-- The shelf also carries the summaries Elgun Jafarov circulated by email
-- in 2023–2026, credited to him, so a summary now names its author and
-- says whether it was generated. `circulated_at` is the day the email went
-- out (null for the routine's own summaries); `tags` are the areas of law,
-- from a fixed list, for the shelf's filters.

alter table public.court_summaries
  add column if not exists author text not null default 'Claude'
    check (length(author) between 1 and 120),
  add column if not exists ai_generated boolean not null default true,
  add column if not exists circulated_at date,
  add column if not exists tags text[] not null default '{}';

alter table public.court_summaries drop constraint if exists court_summaries_tags_check;
alter table public.court_summaries add constraint court_summaries_tags_check
  check (
    cardinality(tags) <= 6
    and tags <@ array[
      'civil', 'commercial', 'corporate', 'property', 'labour', 'tax',
      'banking', 'administrative', 'criminal', 'procedure', 'enforcement', 'constitutional'
    ]
  );
