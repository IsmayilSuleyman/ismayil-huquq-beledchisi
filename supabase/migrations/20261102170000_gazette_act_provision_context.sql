-- The whole clause as it reads after the change, when it could be read
-- (ROUTINE.md step 3a.6: the act quotes it in full, a bill's earlier
-- reading has it, or a consolidated source is available). The board's
-- card then shows the clause with the swapped words marked inside it, as
-- track changes; without it the card shows only the words.

alter table public.gazette_act_provisions
  add column if not exists context_text text check (length(context_text) <= 6000);
