import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allEntries, checkDraft, countSentences, issueTitle, provisionPattern } from "@/scripts/gazette/draft";
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

  it("keeps an act's “Nə dəyişib?” paragraph: up to four sentences of facts, without a №", () => {
    const ok = checkDraft(sample());
    expect(ok.ok && ok.draft.sections.decrees.entries[1].change).toMatch(/^Fərman 2014-cü il 15 may tarixli 168 nömrəli Fərmanla/);
    expect(ok.ok && ok.draft.sections.decrees.entries[0].change).toBeUndefined();

    const raw = sample();
    const entry = raw.sections.decrees.entries[1];
    entry.change = "Bir. İki. Üç. Dörd. Beş.";
    expect(errorsOf(raw)).toContain("sections.decrees.entries[1].change has 5 sentences; the limit is 4");

    entry.change = "Fərman № 168 ilə təsdiq edilmiş Əsasnamənin 1.2-ci bəndi dəyişdirilir.";
    expect(errorsOf(raw).some((e) => e.includes('change must not write "№"'))).toBe(true);

    entry.change = "Dəyişikliklər 2027-ci il 1 yanvar tarixindən qüvvəyə minir";
    expect(errorsOf(raw)).toContain("sections.decrees.entries[1].change must end with a full stop");

    entry.change = entry.text;
    expect(errorsOf(raw).some((e) => e.includes("change repeats the sentence"))).toBe(true);

    entry.change = "x".repeat(1001) + ".";
    expect(errorsOf(raw).some((e) => e.includes("the limit is 1000"))).toBe(true);

    entry.change = "Bu mühüm fərmanla rezidentlərin dairəsi genişləndirilir.";
    const result = checkDraft(raw);
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain("sections.decrees.entries[1].change has no number in it (no article, date, amount or count): is it rich in facts?");
    expect(result.warnings).toContain('sections.decrees.entries[1].change says "mühüm": no praise, guesses or forecasts in it');
  });

  it("keeps the provisions a paragraph cites, and warns when a reference is not in it", () => {
    const ok = checkDraft(sample());
    expect(ok.ok && ok.draft.sections.decrees.entries[1].provisions?.map((p) => p.ref)).toEqual(["1.2.13-cü", "1.2.4-1-ci yarımbənd"]);
    expect(ok.ok && ok.draft.sections.decrees.entries[0].provisions).toBeUndefined();

    const raw = sample();
    const entry = raw.sections.decrees.entries[1];
    entry.provisions = [{ ref: "9.9-cu maddə", text: "Mətn." }];
    const warned = checkDraft(raw);
    expect(warned.ok).toBe(true);
    expect(warned.warnings.some((w) => w.includes('"9.9-cu maddə" is not in the paragraph'))).toBe(true);

    entry.provisions = [
      { ref: "1.2.13-cü", text: "a" },
      { ref: "1.2.13-cü", text: "b" },
    ];
    expect(errorsOf(raw)).toContain('sections.decrees.entries[1].provisions[1]: "1.2.13-cü" is listed twice');

    entry.provisions = [{ ref: "1.2.13-cü", text: "a", kind: "deleted" }];
    expect(errorsOf(raw)).toContain("sections.decrees.entries[1].provisions[0].kind must be one of new, edition, replacement");

    entry.provisions = [{ ref: "1.2.13-cü", text: "" }];
    expect(errorsOf(raw)).toContain("sections.decrees.entries[1].provisions[0].text is missing");

    delete entry.change;
    entry.provisions = [{ ref: "1.2.13-cü", text: "a" }];
    expect(errorsOf(raw)).toContain("sections.decrees.entries[1].provisions[0]: a provision needs a change paragraph to be linked from");
  });

  it("accepts an empty section", () => {
    const raw = sample();
    raw.sections.court = { entries: [] };
    expect(errorsOf(raw)).toEqual([]);
  });
});

describe("provisionPattern", () => {
  it("finds a reference in any case ending, but not inside a longer number", () => {
    const text = "239-cu maddədə cərimə, 239-cu maddəyə görə; 1239-cu maddə yox; 3.2.8-1-ci maddənin və 3.2.8-ci maddə.";
    expect([...text.matchAll(provisionPattern("239-cu maddə"))].map((m) => m[0])).toEqual(["239-cu maddədə", "239-cu maddəyə"]);
    expect([...text.matchAll(provisionPattern("3.2.8-ci"))].map((m) => m[0])).toEqual(["3.2.8-ci"]);
    expect([...text.matchAll(provisionPattern("3.2.8-1-ci"))].map((m) => m[0])).toEqual(["3.2.8-1-ci"]);
    const bare = "2.1, 2.10 və 2.1-1-ci bəndlər, 2.1-də";
    expect([...bare.matchAll(provisionPattern("2.1"))].map((m) => m[0])).toEqual(["2.1", "2.1-də"]);
  });
});

describe("countSentences", () => {
  it("counts sentences the way the one-sentence rule does, ignoring dotted article numbers", () => {
    expect(countSentences("")).toBe(0);
    expect(countSentences("Əsasnamənin 1.2.4-cü yarımbəndi dəyişdirilir.")).toBe(1);
    expect(countSentences("Birinci cümlə. İkinci cümlə “sitatla”. (Üçüncü.) Dördüncü!")).toBe(4);
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
