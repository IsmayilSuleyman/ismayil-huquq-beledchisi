import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkDraft, countByKind, issueTitle } from "@/scripts/gazette/draft";
import { formatPeriod } from "@/lib/gazette-format";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "gazette", "draft.json");

function sample(): Record<string, unknown> {
  return JSON.parse(readFileSync(FIXTURE, "utf8"));
}

function errorsOf(raw: unknown): string[] {
  const result = checkDraft(raw);
  return result.ok ? [] : result.errors;
}

describe("checkDraft", () => {
  it("accepts the sample issue and counts acts per kind", () => {
    const result = checkDraft(sample());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.sections).toHaveLength(5);
    expect(countByKind(result.draft)).toEqual([
      { kind: "law", count: 2 },
      { kind: "bill", count: 1 },
      { kind: "decree", count: 2 },
      { kind: "order", count: 2 },
      { kind: "decision", count: 2 },
      { kind: "court", count: 1 },
    ]);
    // Laws carry their adoption date, before the week they were signed in.
    expect(result.warnings.filter((w) => w.includes("before the period starts"))).toHaveLength(2);
  });

  it("trims strings and drops duplicate tags", () => {
    const raw = sample();
    raw.headline = "  Başlıq  ";
    raw.tags = ["Vergi", "vergi ", "KOB"];
    const result = checkDraft(raw);
    expect(result.ok && result.draft.headline).toBe("Başlıq");
    expect(result.ok && result.draft.tags).toEqual(["Vergi", "KOB"]);
  });

  it("rejects misspelt fields instead of dropping them", () => {
    const raw = sample();
    raw.summery = "typo";
    expect(errorsOf(raw)).toContain('draft: unknown field "summery"');
  });

  it("rejects impossible dates and acts dated after the period", () => {
    const raw = sample();
    (raw.period as Record<string, string>).from = "2026-02-30";
    const sections = raw.sections as { entries: Record<string, string>[] }[];
    sections[1].entries[0].date = "2026-11-20";
    const errors = errorsOf(raw);
    expect(errors.some((e) => e.startsWith("period.from must be a real date"))).toBe(true);
    expect(errors.some((e) => e.includes("is after the end of the period"))).toBe(true);
  });

  it("warns, but still passes, for acts dated before the period", () => {
    const raw = sample();
    const sections = raw.sections as { entries: Record<string, string>[] }[];
    sections[1].entries[0].date = "2026-08-01";
    const result = checkDraft(raw);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes("before the period starts"))).toBe(true);
  });

  it("rejects the same act listed twice", () => {
    const raw = sample();
    const sections = raw.sections as { entries: Record<string, string>[] }[];
    sections[1].entries.push({ ...sections[1].entries[0] });
    expect(errorsOf(raw).some((e) => e.includes("appears twice"))).toBe(true);
  });

  it("needs a notice when a section has no entries", () => {
    const raw = sample();
    const sections = raw.sections as Record<string, unknown>[];
    delete sections[4].notice;
    expect(errorsOf(raw).some((e) => e.includes("no entries and no notice"))).toBe(true);
  });

  it("rejects unknown kinds, bad URLs and an empty source list", () => {
    const raw = sample();
    const sections = raw.sections as { entries: Record<string, string>[] }[];
    sections[1].entries[0].kind = "ferman";
    sections[1].entries[1].url = "javascript:alert(1)";
    raw.sources = [];
    const errors = errorsOf(raw);
    expect(errors.some((e) => e.includes(".kind must be one of"))).toBe(true);
    expect(errors.some((e) => e.includes(".url must be an http(s) URL"))).toBe(true);
    expect(errors.some((e) => e.startsWith("sources is empty"))).toBe(true);
  });

  it("enforces the card-length limits", () => {
    const raw = sample();
    raw.headline = "x".repeat(200);
    expect(errorsOf(raw).some((e) => e.startsWith("draft.headline is 200 characters"))).toBe(true);
  });
});

describe("issueTitle", () => {
  it("follows the library's title pattern, in Azerbaijani", () => {
    expect(issueTitle({ period: { from: "2026-10-26", to: "2026-11-01" } })).toBe(
      "Həftəlik qanunvericilik icmalı, 26 oktyabr – 1 noyabr 2026"
    );
  });
});

describe("formatPeriod", () => {
  it("prints the shortest unambiguous range", () => {
    expect(formatPeriod("2026-09-05", "2026-09-11")).toBe("5–11 sentyabr 2026");
    expect(formatPeriod("2026-08-29", "2026-09-04")).toBe("29 avqust – 4 sentyabr 2026");
    expect(formatPeriod("2026-12-28", "2027-01-03")).toBe("28 dekabr 2026 – 3 yanvar 2027");
    expect(formatPeriod("2026-09-05", "2026-09-05")).toBe("5 sentyabr 2026");
  });
});
