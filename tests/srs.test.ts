import path from "node:path";
import { describe, expect, it } from "vitest";
import { DECKS_ROOT, getDeck, listDecks, parseDeck } from "@/lib/decks";
import { formatInterval, isDue, newState, schedule } from "@/lib/srs";

const NOW = new Date("2026-09-12T10:00:00Z");
const ROOT = path.join(__dirname, "fixtures", "decks");

describe("schedule (SM-2)", () => {
  it("grows intervals on good answers: 1, 6, then interval × ease", () => {
    let s = newState(NOW);
    s = schedule(s, 3, NOW);
    expect(s.intervalDays).toBe(1);
    s = schedule(s, 3, NOW);
    expect(s.intervalDays).toBe(6);
    s = schedule(s, 3, NOW);
    expect(s.intervalDays).toBe(15);
    expect(s.repetitions).toBe(3);
    expect(s.ease).toBe(2.5);
    expect(new Date(s.dueAt).getTime() - NOW.getTime()).toBe(15 * 86_400_000);
  });

  it("resets on again, lowers ease and comes back in minutes", () => {
    let s = schedule(schedule(newState(NOW), 3, NOW), 3, NOW);
    s = schedule(s, 1, NOW);
    expect(s).toMatchObject({ intervalDays: 0, repetitions: 0, lapses: 1, ease: 2.3 });
    expect(new Date(s.dueAt).getTime() - NOW.getTime()).toBe(10 * 60_000);
    expect(isDue(s, new Date(NOW.getTime() + 11 * 60_000))).toBe(true);
    expect(isDue(s, NOW)).toBe(false);
  });

  it("never drops ease below 1.3 and easy jumps ahead", () => {
    let s = newState(NOW);
    for (let i = 0; i < 10; i++) s = schedule(s, 1, NOW);
    expect(s.ease).toBe(1.3);
    const easy = schedule(newState(NOW), 4, NOW);
    expect(easy.intervalDays).toBe(4);
    expect(easy.ease).toBe(2.65);
    const hard = schedule(newState(NOW), 2, NOW);
    expect(hard.intervalDays).toBe(1);
    expect(hard.ease).toBe(2.35);
  });

  it("formats the promised interval per rating", () => {
    const s = newState(NOW);
    expect(formatInterval(s, 1, NOW)).toBe("10 dəq");
    expect(formatInterval(s, 3, NOW)).toBe("1 gün");
    expect(formatInterval(s, 4, NOW)).toBe("4 gün");
    const mature = { ...s, intervalDays: 40, repetitions: 4 };
    expect(formatInterval(mature, 3, NOW)).toBe("3 ay");
  });
});

describe("decks", () => {
  it("loads a deck with its cards and defaults", async () => {
    const deck = await getDeck("test-deck", ROOT);
    expect(deck?.cards.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(deck?.cards[1].hint).toBeNull();
    expect(deck?.newPerDay).toBe(2);
    expect((await listDecks(ROOT)).map((d) => d.slug)).toEqual(["test-deck"]);
    expect(await getDeck("../test-deck", ROOT)).toBeNull();
  });

  it("rejects duplicate ids and empty sides", () => {
    expect(() => parseDeck({ title: "x", cards: [{ id: "a", front: "f", back: "b" }, { id: "a", front: "f", back: "b" }] }, "d")).toThrow(/duplicate/);
    expect(() => parseDeck({ title: "x", cards: [{ id: "a", front: "", back: "b" }] }, "d")).toThrow(/front and back/);
  });

  it("every real deck is valid and points at existing content", async () => {
    const decks = await listDecks(DECKS_ROOT);
    expect(decks.length).toBeGreaterThan(0);
    for (const deck of decks) {
      expect(deck.cards.length, deck.slug).toBeGreaterThanOrEqual(8);
      expect(deck.source?.href, deck.slug).toMatch(/^\/(courses|resources)\//);
    }
    const orders = decks.map((d) => d.order);
    expect(new Set(orders).size).toBe(orders.length);
  });
});
