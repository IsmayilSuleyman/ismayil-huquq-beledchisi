import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allEntries, checkDraft, issueTitle } from "@/scripts/gazette/draft";
import { formatPeriod } from "@/lib/gazette-format";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "gazette", "draft.json");

type Raw = {
  sections: Record<string, { note?: string; entries: Record<string, unknown>[] }>;
  [key: string]: unknown;
};

function sample(): Raw {
  return JSON.parse(readFileSync(FIXTURE, "utf8"));
}

function errorsOf(raw: unknown): string[] {
  const result = checkDraft(raw);
  return result.ok ? [] : result.errors;
}

describe("checkDraft", () => {
  it("accepts the sample issue and numbers its acts across the four sections", () => {
    const result = checkDraft(sample());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(allEntries(result.draft).map((e) => e.section)).toEqual([
      "decrees",
      "decrees",
      "decisions",
      "decisions",
      "bills",
      "bills",
      "court",
      "court",
    ]);
    expect(result.draft.sections.court.entries.map((e) => e.ruling)).toEqual(["qərardad", "qərar"]);
  });

  it("trims and collapses whitespace in a sentence", () => {
    const raw = sample();
    raw.sections.decrees.entries[0].text = "  Strategiya   təsdiq\nedilib.  ";
    const result = checkDraft(raw);
    expect(result.ok && result.draft.sections.decrees.entries[0].text).toBe("Strategiya təsdiq edilib.");
  });

  it("rejects misspelt fields instead of dropping them", () => {
    const raw = sample();
    raw.summery = "typo";
    raw.sections.decisions.entries[0].titel = "typo";
    const errors = errorsOf(raw);
    expect(errors).toContain('draft: unknown field "summery"');
    expect(errors).toContain('sections.decisions.entries[0]: unknown field "titel"');
  });

  it("holds every act to one sentence, without its number", () => {
    const raw = sample();
    raw.sections.decisions.entries[0].text = "Strategiya təsdiq edilib. Nazirlik hesabat verəcək.";
    raw.sections.decisions.entries[1].text = "Qayda təsdiq edilib (Qərar № 349).";
    raw.sections.decrees.entries[0].text = "Tədbirlər müəyyən edilib";
    const errors = errorsOf(raw);
    expect(errors).toContain("sections.decisions.entries[0].text must be one sentence");
    expect(errors.some((e) => e.startsWith("sections.decisions.entries[1].text must not carry the act's number"))).toBe(true);
    expect(errors).toContain("sections.decrees.entries[0].text must end with a full stop");
  });

  it("needs a bill's reading and a court ruling's type to be valid", () => {
    const raw = sample();
    delete raw.sections.bills.entries[0].stage;
    raw.sections.court.entries[0].ruling = "hökm";
    const errors = errorsOf(raw);
    expect(errors.some((e) => e.startsWith("sections.bills.entries[0].stage must be one of"))).toBe(true);
    expect(errors).toContain('sections.court.entries[0].ruling must be "qərar" or "qərardad"');
  });

  it("rejects impossible dates and acts dated after the period, warns for earlier ones", () => {
    const raw = sample();
    (raw.period as Record<string, string>).from = "2026-02-30";
    raw.sections.decrees.entries[0].date = "2026-11-20";
    expect(errorsOf(raw).some((e) => e.startsWith("period.from must be a real date"))).toBe(true);
    expect(errorsOf(raw).some((e) => e.includes("is after the end of the period"))).toBe(true);

    const early = sample();
    early.sections.decrees.entries[0].date = "2026-10-01";
    const result = checkDraft(early);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes("before the period starts"))).toBe(true);
  });

  it("rejects the same act twice in a section, and a missing section", () => {
    const raw = sample();
    raw.sections.decisions.entries.push({ ...raw.sections.decisions.entries[0] });
    expect(errorsOf(raw).some((e) => e.includes("the same act appears twice in decisions"))).toBe(true);

    const missing = sample();
    delete missing.sections.court;
    expect(errorsOf(missing).some((e) => e.startsWith("sections.court is missing"))).toBe(true);
  });

  it("accepts an empty section", () => {
    const raw = sample();
    raw.sections.court = { entries: [] };
    expect(errorsOf(raw)).toEqual([]);
  });
});

describe("issueTitle", () => {
  it("follows the library's title pattern from issues 1–12", () => {
    expect(issueTitle({ period: { from: "2026-10-19", to: "2026-10-25" } })).toBe("Weekly Legislature Update, October 19-25");
    expect(issueTitle({ period: { from: "2026-09-28", to: "2026-10-04" } })).toBe(
      "Weekly Legislature Update, September 28 – October 4"
    );
    expect(issueTitle({ period: { from: "2026-12-28", to: "2027-01-03" } })).toBe(
      "Weekly Legislature Update, December 28, 2026 – January 3, 2027"
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
