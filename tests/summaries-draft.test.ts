import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allBullets, checkDraft, quotedWords, tidyQuote } from "@/scripts/summaries/draft";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "summaries", "draft.json");

type Raw = { blocks: { heading?: string; bullets: Record<string, unknown>[] }[]; [key: string]: unknown };

function sample(): Raw {
  return JSON.parse(readFileSync(FIXTURE, "utf8"));
}

function errorsOf(raw: unknown): string[] {
  const result = checkDraft(raw);
  return result.ok ? [] : result.errors;
}

describe("checkDraft (court summaries)", () => {
  it("accepts the approved test summary of the Qərardad of 25 September 2026", () => {
    const result = checkDraft(sample());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(allBullets(result.draft.blocks)).toHaveLength(7);
    expect(quotedWords(result.draft.blocks)).toBeGreaterThan(300);
    expect(result.draft.kind).toBe("qərardad");
  });

  it("rejects misspelt fields instead of dropping them", () => {
    const raw = sample();
    raw.topik = "typo";
    raw.blocks[0].bullets[0].txt = "typo";
    const errors = errorsOf(raw);
    expect(errors).toContain('draft: unknown field "topik"');
    expect(errors).toContain('blocks[0].bullets[0]: unknown field "txt"');
  });

  it("keeps the email frame out and strips a 'Topic --' prefix", () => {
    const raw = sample();
    raw.blocks[0].bullets.push({ text: "Regards, Elgun — thank you all for reading this far." });
    raw.topic = "***Topic -- Is the written form a validity requirement?***";
    const result = checkDraft(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain("blocks[0].bullets[7].text carries a trace of the email frame");
    expect(result.warnings).toContain('draft.topic: dropped the "Topic --" prefix; the layout adds it');
  });

  it("holds the draft to the decision: id and link must agree, marks must close", () => {
    const raw = sample();
    raw.url = "https://constcourt.gov.az/az/decision/1541";
    raw.blocks[0].bullets[1].text = "__Reyestr məlumatlarının düzgün hesab edilməsi ilə bağlı prezumpsiya";
    const errors = errorsOf(raw);
    expect(errors).toContain("draft.url points at decision 1541 but decision_id is 1630");
    expect(errors).toContain("blocks[0].bullets[1].text: underline (__) not closed");
  });

  it("warns about lead-ins and citations the method deletes, without blocking", () => {
    const raw = sample();
    raw.blocks[0].bullets[0].text =
      "Konstitusiya Məhkəməsinin Plenumu hesab edir ki, daşınmaz əmlakın dövlət reyestri hüquqyaradıcı funksiyaya malikdir (Konstitusiya Məhkəməsi Plenumunun 2015-ci il 6 avqust tarixli Qərarı).";
    const result = checkDraft(raw);
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain("blocks[0].bullets[0].text starts with a lead-in the method deletes (STYLE.md 6.1)");
    expect(result.warnings).toContain("blocks[0].bullets[0].text keeps a bracketed citation of an earlier decision (STYLE.md 5.2)");
  });

  it("needs two to twelve bullets and a heading per block when there are several", () => {
    const raw = sample();
    raw.blocks = [{ bullets: [raw.blocks[0].bullets[0]] }, { heading: "(B) İkinci məsələ", bullets: [raw.blocks[0].bullets[1]] }];
    const errors = errorsOf(raw);
    expect(errors).toContain("blocks[0].heading is missing: every block needs one when there are several");
    const one = sample();
    one.blocks[0].bullets = [one.blocks[0].bullets[0]];
    expect(errorsOf(one)).toContain("the summary has 1 bullet(s); the method takes at least 2");
  });

  it("rejects a future date and an unknown form of act", () => {
    const raw = sample();
    raw.decision_date = "2999-01-01";
    raw.kind = "hökm";
    const errors = errorsOf(raw);
    expect(errors).toContain("draft.decision_date 2999-01-01 is in the future");
    expect(errors).toContain('draft.kind must be "qərar" or "qərardad"');
  });

  it("tidies copied text the way the method does: straight quotes, no soft hyphens", () => {
    expect(tidyQuote("“Daşıyıcı”  anlayışı­\n  ‘belə’")).toBe(`"Daşıyıcı" anlayışı 'belə'`);
  });
});
