/**
 * The acts with earlier wordings: one JSON file per act under
 * content/versions (built by scripts/versions/build.mts and committed).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { VersionedAct } from "@/lib/versions/types";

const ROOT = path.join(process.cwd(), "content", "versions");

export async function listVersionedSlugs(): Promise<string[]> {
  let files: string[] = [];
  try {
    files = await fs.readdir(ROOT);
  } catch {
    return [];
  }
  return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
}

export async function getVersionedAct(slug: string): Promise<VersionedAct | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, `${slug}.json`), "utf8")) as VersionedAct;
  } catch {
    return null;
  }
}

/** True when the article has more than its original wording, or did not exist at first. */
export function isAmended(act: VersionedAct, number: string): boolean {
  const versions = act.articles[number]?.versions ?? [];
  return versions.length > 1 || versions[0]?.act !== act.original.id;
}
