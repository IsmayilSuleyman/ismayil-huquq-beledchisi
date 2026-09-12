import { promises as fs } from "node:fs";
import path from "node:path";
import { isSlug } from "@/lib/content";

/**
 * Flashcard decks for the Öyrən section. One JSON file per deck:
 *
 *   content/decks/<slug>.json
 *   {
 *     "title": "Hüquq anlayışı",
 *     "description": "...",
 *     "order": 1,
 *     "source": { "label": "Dərs: Hüquq anlayışı", "href": "/courses/..." },
 *     "newPerDay": 15,
 *     "cards": [{ "id": "c1", "front": "Sual", "back": "Cavab", "hint": "..." }]
 *   }
 */

export const DECKS_ROOT = path.join(process.cwd(), "content", "decks");

export type Card = { id: string; front: string; back: string; hint: string | null };

export type Deck = {
  slug: string;
  title: string;
  description: string;
  order: number;
  source: { label: string; href: string } | null;
  newPerDay: number;
  cards: Card[];
};

export type DeckMeta = Omit<Deck, "cards"> & { cardCount: number };

export const DEFAULT_NEW_PER_DAY = 15;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Validates the raw JSON; throws with a readable message on a bad file. */
export function parseDeck(raw: unknown, slug: string): Deck {
  if (!raw || typeof raw !== "object") throw new Error(`${slug}: deck must be an object`);
  const d = raw as Record<string, unknown>;
  const title = str(d.title);
  if (!title) throw new Error(`${slug}: missing title`);
  if (!Array.isArray(d.cards) || d.cards.length === 0) throw new Error(`${slug}: needs cards`);
  const ids = new Set<string>();
  const cards: Card[] = d.cards.map((c, i) => {
    const item = (c ?? {}) as Record<string, unknown>;
    const id = str(item.id);
    if (!id) throw new Error(`${slug}: card ${i + 1} missing id`);
    if (ids.has(id)) throw new Error(`${slug}: duplicate card id "${id}"`);
    ids.add(id);
    const front = str(item.front);
    const back = str(item.back);
    if (!front || !back) throw new Error(`${slug}: card "${id}" needs front and back`);
    return { id, front, back, hint: str(item.hint) };
  });
  const src = d.source && typeof d.source === "object" ? (d.source as Record<string, unknown>) : null;
  const source = src && str(src.label) && str(src.href) ? { label: str(src.label)!, href: str(src.href)! } : null;
  const newPerDay =
    typeof d.newPerDay === "number" && d.newPerDay > 0 ? Math.floor(d.newPerDay) : DEFAULT_NEW_PER_DAY;
  return {
    slug,
    title,
    description: str(d.description) ?? "",
    order: typeof d.order === "number" && Number.isFinite(d.order) ? d.order : 0,
    source,
    newPerDay,
    cards,
  };
}

export async function getDeck(slug: string, root: string = DECKS_ROOT): Promise<Deck | null> {
  if (!isSlug(slug)) return null;
  let raw: string;
  try {
    raw = await fs.readFile(path.join(root, `${slug}.json`), "utf8");
  } catch {
    return null;
  }
  return parseDeck(JSON.parse(raw), slug);
}

export async function listDecks(root: string = DECKS_ROOT): Promise<Deck[]> {
  let files: string[];
  try {
    files = await fs.readdir(root);
  } catch {
    return [];
  }
  const decks: Deck[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const slug = file.slice(0, -".json".length);
    if (!isSlug(slug)) continue;
    const deck = await getDeck(slug, root);
    if (deck) decks.push(deck);
  }
  return decks.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "az"));
}

export function countCards(decks: Deck[]): number {
  return decks.reduce((n, d) => n + d.cards.length, 0);
}
