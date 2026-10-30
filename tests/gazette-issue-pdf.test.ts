import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzePdfBuffer } from "@/scripts/gazette/cover";
import { checkDraft } from "@/scripts/gazette/draft";
import { renderIssuePdf } from "@/scripts/gazette/issue-pdf";
import { pdfText as rawPdfText } from "@/scripts/gazette/pdf-text";

/** All text in a PDF on one line, so sentences broken across lines still match. */
async function pdfText(pdf: Uint8Array): Promise<string> {
  return (await rawPdfText(pdf)).replace(/\s+/g, " ");
}

const FIXTURE = path.join(import.meta.dirname, "fixtures", "gazette", "draft.json");

describe("issue PDF", () => {
  it("renders the sample issue and makes a WebP cover from page 1", async () => {
    const result = checkDraft(JSON.parse(readFileSync(FIXTURE, "utf8")));
    if (!result.ok) throw new Error(result.errors.join("\n"));

    const pdf = await renderIssuePdf(result.draft, 3, "2026-10-26");
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const { pageCount, cover } = await analyzePdfBuffer(pdf);
    expect(pageCount).toBeGreaterThanOrEqual(1);
    expect(cover.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(cover.subarray(8, 12).toString("latin1")).toBe("WEBP");
  }, 30_000);

  it("says when a catch-up issue was really written", async () => {
    const result = checkDraft(JSON.parse(readFileSync(FIXTURE, "utf8")));
    if (!result.ok) throw new Error(result.errors.join("\n"));
    const onTime = await pdfText(await renderIssuePdf(result.draft, 3, "2026-10-27"));
    const late = await pdfText(await renderIssuePdf(result.draft, 3, "2026-10-30"));
    expect(onTime).not.toContain("gecikmə ilə");
    expect(late).toContain("Bu buraxılış gecikmə ilə, 30 oktyabr 2026 tarixində hazırlanıb.");
  }, 30_000);
});
