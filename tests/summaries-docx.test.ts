import { readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { checkDraft } from "@/scripts/summaries/draft";
import { renderSummaryDocx } from "@/scripts/summaries/docx";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "summaries", "draft.json");

describe("summary Word file", () => {
  it("lays the test summary out with the firm's header, the AI notice and the emphasis, and no email frame", async () => {
    const checked = checkDraft(JSON.parse(readFileSync(FIXTURE, "utf8")));
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    const buffer = await renderSummaryDocx(checked.draft, { generatedAt: new Date("2026-10-31T09:00:00Z") });
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.keys(zip.files);
    expect(files.some((f) => /^word\/media\/.*\.(jpg|jpeg)$/.test(f))).toBe(true);

    const header = await zip.file(/^word\/header\d*\.xml$/)[0]?.async("string");
    expect(header).toContain("<pic:pic");
    expect(header).toContain("Decision summaries");

    const footer = await zip.file(/^word\/footer\d*\.xml$/)[0]?.async("string");
    expect(footer).toContain("AI-generated summary · Omni Law Firm · 31 October 2026");
    expect(footer).toContain("PAGE");

    const body = await zip.file("word/document.xml")!.async("string");
    expect(body).toContain("Qərardad of 25 September 2026");
    expect(body).toContain("AI-generated summary.");
    expect(body).toContain("Topic — ");
    expect(body).toContain("https://constcourt.gov.az/az/decision/1630");
    // Elgun's underline and bold survive as run properties.
    expect(body).toContain('<w:u w:val="single"/>');
    expect(body).toContain("hüquqtəsdiqedici");
    expect(body).toMatch(new RegExp('<w:b/>(?:<w:[^>]*/>)*<w:u w:val="single"/></w:rPr><w:t[^>]*>hüquqtəsdiqedici'));
    // No email frame, and no marks left in the text.
    expect(body).not.toMatch(/Dear all|Regards|Elgun|\*\*|__/);
  });
});
