import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzePdfBuffer } from "@/scripts/gazette/cover";
import { checkDraft, type GazetteDraft } from "@/scripts/gazette/draft";
import { renderIssuePdf } from "@/scripts/gazette/issue-pdf";
import { pdfText as rawPdfText } from "@/scripts/gazette/pdf-text";

/** All text in a PDF on one line, so sentences broken across lines still match. */
async function pdfText(pdf: Uint8Array): Promise<string> {
  return (await rawPdfText(pdf)).replace(/\s+/g, " ");
}

const FIXTURE = path.join(import.meta.dirname, "fixtures", "gazette", "draft.json");

function sample(): GazetteDraft {
  const result = checkDraft(JSON.parse(readFileSync(FIXTURE, "utf8")));
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return result.draft;
}

describe("issue PDF", () => {
  it("renders the sample issue and makes a WebP cover from page 1", async () => {
    const pdf = await renderIssuePdf(sample(), 18, "2026-10-26");
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const { pageCount, cover } = await analyzePdfBuffer(pdf);
    expect(pageCount).toBeGreaterThanOrEqual(1);
    expect(cover.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(cover.subarray(8, 12).toString("latin1")).toBe("WEBP");
  }, 30_000);

  it("prints the parts of the old issues' format", async () => {
    const text = await pdfText(await renderIssuePdf(sample(), 18, "2026-10-26"));
    for (const part of [
      "BU HƏFTƏNİN İCMALI",
      "AZƏRBAYCAN QANUNVERİCİLİYİ",
      "BURAXILIŞ №. 18",
      "19–25 OKTYABR 2026",
      "Azərbaycan Respublikası Prezidentinin Fərmanları",
      "PREZİDENT FƏRMANI",
      "19 Oktyabr 2026",
      "Səhiyyə Nazirliyinin tabeliyinə verilib. (Fərman № 804)",
      "(Qərar № 346)",
      "Milli Məclisdə müzakirə olunan qanun layihələri",
      "üçüncü oxunuşda",
      "KONSTİTUSİYA MƏHKƏMƏSİNİN QƏRARDADI",
      "Mənbə: https://e-qanun.az/framework/62764",
    ]) {
      expect(text).toContain(part);
    }
    // Items are numbered through the issue: the last of eight is 08.
    expect(text).toContain("08");
  }, 30_000);

  it("says when a section has nothing this week", async () => {
    const draft = sample();
    draft.sections.court = { entries: [] };
    const text = await pdfText(await renderIssuePdf(draft, 18, "2026-10-26"));
    expect(text).toContain("Konstitusiya Məhkəməsinin Qərarları (bu həftəlik heçnə yoxdur)");
  }, 30_000);

  it("closes with who prepared the issue, and when if late", async () => {
    const onTime = await pdfText(await renderIssuePdf(sample(), 18, "2026-10-27"));
    const late = await pdfText(await renderIssuePdf(sample(), 18, "2026-10-30"));
    const reviewed = await pdfText(await renderIssuePdf({ ...sample(), reviewed: true }, 18, "2026-10-27"));
    expect(onTime).toContain("redaktə olunmayıb");
    expect(onTime).not.toContain("Gecikmə ilə");
    expect(late).toContain("Gecikmə ilə, 30 oktyabr 2026 tarixində hazırlanıb.");
    expect(reviewed).toContain("redaksiya tərəfindən yoxlanılıb");
    expect(reviewed).not.toContain("redaktə olunmayıb");
  }, 30_000);
});
