import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzePdfBuffer } from "@/scripts/gazette/cover";
import { checkDraft } from "@/scripts/gazette/draft";
import { renderIssuePdf } from "@/scripts/gazette/issue-pdf";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "gazette", "draft.json");

describe("issue PDF", () => {
  it("renders the sample issue and makes a WebP cover from page 1", async () => {
    const result = checkDraft(JSON.parse(readFileSync(FIXTURE, "utf8")));
    if (!result.ok) throw new Error(result.errors.join("\n"));

    const pdf = await renderIssuePdf(result.draft, 3);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const { pageCount, cover } = await analyzePdfBuffer(pdf);
    expect(pageCount).toBeGreaterThanOrEqual(1);
    expect(cover.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(cover.subarray(8, 12).toString("latin1")).toBe("WEBP");
  }, 30_000);
});
