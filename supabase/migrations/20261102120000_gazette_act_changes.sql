-- "Nə dəyişib?" (what changed): the weekly routine now reads every act's
-- full text, compares an amendment with the wording it replaces, and writes
-- one to four sentences of facts about the change in Azerbaijani
-- (scripts/gazette/ROUTINE.md, step 3; the draft's `change` field in
-- scripts/gazette/draft.ts). The board's panel shows the paragraph when a
-- reader opens the act, and the issue PDF prints it under the sentence.
-- Null for the acts of earlier issues and for an act whose text the
-- routine could not read; the publisher writes it with the other columns.

alter table public.gazette_acts
  add column if not exists change text check (length(change) between 1 and 1000);
