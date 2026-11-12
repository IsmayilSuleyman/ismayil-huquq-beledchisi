import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diffParagraphs, diffWords } from "@/lib/versions/diff";
import { versionAt } from "@/lib/versions/act";
import type { VersionedAct } from "@/lib/versions/types";
import { readAmendingAct, readChange, readEndnote } from "@/scripts/versions/changes";
import { MARK } from "@/scripts/versions/eqanun-html";
import { readable, undo, type Snapshot } from "@/scripts/versions/rebuild";

const acts = [{ id: "2016", number: "20/83" }];

describe("change sentences", () => {
  it("reads a word swap in a sentence of a part", () => {
    const { ops, unread } = readChange(
      "25-ci maddədə III hissənin birinci cümləsində “milliyyətindən” sözü “etnik mənsubiyyətindən” sözləri ilə, ikinci cümləsində “milli” sözü “etnik” sözü ilə əvəz edilmişdir.",
    );
    expect(unread).toEqual([]);
    expect(ops).toEqual([
      { kind: "replace", scope: { article: "25", parts: ["III"], sentence: 1 }, old: "milliyyətindən", new: "etnik mənsubiyyətindən" },
      { kind: "replace", scope: { article: "25", parts: ["III"], sentence: 2 }, old: "milli", new: "etnik" },
    ]);
  });

  it("reads renumbering and an added part, in order", () => {
    const { ops } = readChange("24-cü maddədə I və II hissələr, müvafiq olaraq, II və III hissələr hesab edilmişdir və həmin maddəyə yeni məzmunda I hissə əlavə edilmişdir.");
    expect(ops.map((o) => o.kind)).toEqual(["renumberParts", "addParts"]);
  });

  it("finds the change in an endnote and keeps the old wording it quotes", () => {
    const [change] = readEndnote(
      "11 oktyabr 2016-cı il 20/83 nömrəli Azərbaycan Respublikası Mərkəzi Seçki Komissiyasının Qərarı (“Azərbaycan” qəzeti, 12 oktyabr 2016-cı il, № 224) ilə 68-ci maddənin adı yeni redaksiyada verilmişdir.\nƏvvəlki redaksiyada deyilirdi:\nZərərin ödənilməsini tələb etmək hüququ",
      acts,
    );
    expect(change.act).toBe("2016");
    expect(change.ops).toEqual([{ kind: "newText", scope: { article: "68", title: true }, old: ["Zərərin ödənilməsini tələb etmək hüququ"] }]);
  });

  it("reads an amending act's items, bullets included", () => {
    const items = readAmendingAct(
      "XI. 102-ci maddədə «7» rəqəmi «14» rəqəmi ilə əvəz edilsin.\nXII. 105-ci maddədə:\n- I hissədə «A» sözləri «B» sözləri ilə əvəz edilsin;",
    );
    expect(items.map((i) => i.item)).toEqual(["XI", "XII"]);
    expect(items[1].ops).toEqual([{ kind: "replace", scope: { article: "105", parts: ["I"] }, old: "A", new: "B" }]);
  });
});

describe("stepping an article back", () => {
  it("restores a swapped word and drops an added part", () => {
    const snap: Snapshot = {
      title: "Dövlət mülkiyyəti",
      paragraphs: [`I. ${MARK.addOpen}Mərkəzi${MARK.addClose} Bank.`, `${MARK.addOpen}II. Yeni hissə.${MARK.addClose}`],
    };
    undo(snap, { kind: "addParts", scope: { article: "19" }, labels: ["II"] });
    undo(snap, { kind: "replace", scope: { article: "19", parts: ["I"] }, old: "Milli", new: "Mərkəzi" });
    expect(readable(snap).paragraphs).toEqual(["I. Milli Bank."]);
  });

  it("puts back struck words", () => {
    const snap: Snapshot = { title: "T", paragraphs: [`IV. Torpaq ${MARK.delOpen}və ya ictimai ehtiyaclar${MARK.delClose} üçün.`] };
    expect(readable(snap).paragraphs).toEqual(["IV. Torpaq üçün."]);
    undo(snap, { kind: "remove", scope: { article: "29", parts: ["IV"] }, words: "və ya ictimai ehtiyaclar" });
    expect(readable(snap).paragraphs).toEqual(["IV. Torpaq və ya ictimai ehtiyaclar üçün."]);
  });
});

describe("word diff", () => {
  it("marks a swap as removed then added", () => {
    expect(diffWords("Milli Bank", "Mərkəzi Bank")).toEqual([
      { kind: "del", text: "Milli" },
      { kind: "ins", text: "Mərkəzi" },
      { kind: "same", text: " Bank" },
    ]);
  });

  it("splits pieces into paragraphs", () => {
    const lines = diffParagraphs(diffWords("I. A.", "I. A.\nII. B."));
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual([{ kind: "ins", text: "II. B." }]);
  });
});

describe("content/versions/konstitusiya.json", () => {
  const act = JSON.parse(readFileSync("content/versions/konstitusiya.json", "utf8")) as VersionedAct;

  it("has every article, 1–158 and the six added in 2016", () => {
    const numbers = Object.keys(act.articles);
    expect(numbers).toHaveLength(164);
    for (const n of ["98-1", "103-1", "106-1", "108-1", "110-1", "146-1"]) expect(act.articles[n].versions[0].act).toBe("2016");
  });

  it("lists wordings oldest first, each ending where the next begins", () => {
    for (const history of Object.values(act.articles)) {
      history.versions.forEach((v, i) => {
        const next = history.versions[i + 1];
        expect(v.to).toBe(next ? next.from : null);
        if (next) expect(next.from > v.from).toBe(true);
      });
    }
  });

  it("gives the 1995, 2002 and later wordings of Article 71, Part III", () => {
    const part = (date: string) => versionAt(act.articles["71"], date)!.paragraphs.find((p) => p.startsWith("III."))!;
    expect(part("2000-01-01")).toMatch(/^III\. Yalnız müharibə/);
    expect(part("2005-01-01")).toMatch(/^III\. Müharibə/);
  });

  it("has no article before it existed", () => {
    expect(versionAt(act.articles["98-1"], "2010-01-01")).toBeNull();
    expect(versionAt(act.articles["98-1"], "2020-01-01")).not.toBeNull();
  });
});
