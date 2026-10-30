# Catch-up issues: 12 September – 25 October 2026

The gazette published nothing between issue 12 (5–11 September) and the
start of the weekly routine. These drafts fill the gap, one issue per week,
each written by following `scripts/gazette/ROUTINE.md` as a catch-up run
and checked with a dry run.

| File | Period | Issue date |
| --- | --- | --- |
| `2026-09-12_2026-09-20.json` | 12–20 September (takes in the weekend after issue 12) | 2026-09-21 |
| `2026-09-21_2026-09-27.json` | 21–27 September | 2026-09-28 |
| `2026-09-28_2026-10-04.json` | 28 September – 4 October | 2026-10-05 |
| `2026-10-05_2026-10-11.json` | 5–11 October | 2026-10-12 |
| `2026-10-12_2026-10-18.json` | 12–18 October | 2026-10-19 |
| `2026-10-19_2026-10-25.json` | 19–25 October | 2026-10-26 |

Each issue keeps its week's date so the library groups it with its week;
its PDF says it was written late.

## Review

Each issue's disclaimer says it was written by AI and not edited, unless
its file says `"reviewed": true`; then it says the editors checked it. Set
that only for the issues a person has read and approved.

## Publishing

Oldest first, one at a time, so they take numbers 13–18 in order. Each
publish compares the draft with the issue before it and warns about
repeated act numbers; stop and look if it does.

```bash
for f in scripts/gazettes/backfill/2026-*.json; do
  npm run gazette:publish -- "$f" --dry-run --out /tmp/backfill || break
  npm run gazette:publish -- "$f" || break
done
```

Publishing needs `GAZETTE_PUBLISHER_EMAIL` and `GAZETTE_PUBLISHER_PASSWORD`.
A file whose period is already published is skipped, so the loop can be
run again after an interruption.
