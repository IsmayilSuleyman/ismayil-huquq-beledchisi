import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzePdfBuffer } from "@/scripts/gazette/cover";
import { checkDraft } from "@/scripts/gazette/draft";
import { renderIssuePdf } from "@/scripts/gazette/issue-pdf";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "gazette", "draft.json");

/** All text in a PDF, pages joined, whitespace collapsed. */
async function pdfText(pdf: Uint8Array): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    for (const item of content.items) if ("str" in item) parts.push(item.str);
  }
  await doc.destroy();
  return parts.join(" ").replace(/\s+/g, " ");
}

describe("issue PDF", () => {
  it("renders the sample issue and makes a WebP cover from page 1", async () => {
    const result = checkDraft(JSON.parse(readFileSync(FIXTURE, "utf8")));
    if (!result.ok) throw new Error(result.errors.join("\n"));

    const pdf = await renderIssuePdf(result.draft, 3, "2026-09-05");
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const { pageCount, cover } = await analyzePdfBuffer(pdf);
    expect(pageCount).toBeGreaterThanOrEqual(1);
    expect(cover.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(cover.subarray(8, 12).toString("latin1")).toBe("WEBP");
  }, 30_000);

  it("says when a catch-up issue was really written", async () => {
    const result = checkDraft(JSON.parse(readFileSync(FIXTURE, "utf8")));
    if (!result.ok) throw new Error(result.errors.join("\n"));
    const onTime = await pdfText(await renderIssuePdf(result.draft, 3, "2026-09-06"));
    const late = await pdfText(await renderIssuePdf(result.draft, 3, "2026-10-30"));
    expect(onTime).not.toContain("gecikmə ilə");
    expect(late).toContain("Bu buraxılış gecikmə ilə, 30 oktyabr 2026 tarixində hazırlanıb.");
  }, 30_000);
});
