-- How a provision's clause text was obtained: the original act and the
-- amendments the routine applied to rebuild it (ROUTINE.md step 3a.6).
-- Shown in the card's footnote so a reader can check the chain.
alter table public.gazette_act_provisions
  add column if not exists context_basis text check (length(context_basis) <= 300);
