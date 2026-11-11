/** Reading the versions data: which wording was in force on a day, and the acts by id. */

import type { Amendment, ArticleHistory, ArticleVersion, VersionedAct } from "@/lib/versions/types";

/** The article's wording in force on `date` (YYYY-MM-DD), or null before it existed. */
export function versionAt(history: ArticleHistory, date: string): ArticleVersion | null {
  let found: ArticleVersion | null = null;
  for (const v of history.versions) if (v.from <= date) found = v;
  return found;
}

/** The amendment (or the original adoption) a wording comes from. */
export function amendmentOf(act: VersionedAct, id: string): Amendment | null {
  return act.amendments.find((a) => a.id === id) ?? null;
}

/** "27.11.1995" from "1995-11-27". */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
