import { describe, expect, it } from "vitest";
import {
  azDate,
  dottedDate,
  enrichLaws,
  isAnnex,
  mergeLeads,
  sameAct,
  sameTitle,
  stripActName,
  type Lead,
} from "@/scripts/gazette/leads";

const KYRGYZ_ROADS =
  "“Azərbaycan Respublikası Hökuməti ilə Qırğız Respublikası Nazirlər Kabineti arasında beynəlxalq avtomobil əlaqələri haqqında Saziş”in təsdiq edilməsi barədə";
const KYRGYZ_FUND =
  "“Azərbaycan Respublikası Hökuməti ilə Qırğız Respublikası Nazirlər Kabineti arasında Azərbaycan-Qırğız İnkişaf Fondunun yaradılması haqqında 2022-ci il 11 oktyabr tarixli Sazişə dəyişikliklərin edilməsi haqqında İkinci Əlavə Saziş”in təsdiq edilməsi barədə";

function lead(over: Partial<Lead>): Lead {
  return {
    kind: "law",
    institution: "Milli Məclis",
    date: "2026-10-21",
    title: KYRGYZ_ROADS,
    url: "https://example.az/1",
    source: "president.az",
    ...over,
  };
}

describe("dates", () => {
  it("reads Azerbaijani and dotted dates", () => {
    expect(azDate("30 Oktyabr 2026 - 13:12")).toBe("2026-10-30");
    expect(azDate("5 sentyabr 2026")).toBe("2026-09-05");
    expect(azDate("no date here")).toBeNull();
    expect(dottedDate("26.10.2026 Azərbaycan …")).toBe("2026-10-26");
    expect(dottedDate("20.10.26 Azərbaycan …")).toBe("2026-10-20");
  });
});

describe("titles", () => {
  it("drops president.az's trailing act name", () => {
    expect(stripActName("Qarabağ Milli Parkının yaradılması haqqında Azərbaycan Respublikası Prezidentinin Sərəncamı")).toBe(
      "Qarabağ Milli Parkının yaradılması haqqında"
    );
  });

  it("keeps two agreements with the same government apart", () => {
    // Both open with the same 90-odd characters; the old 70-character key merged them.
    expect(sameTitle(KYRGYZ_ROADS, KYRGYZ_FUND)).toBe(false);
    expect(sameTitle(KYRGYZ_ROADS, `${KYRGYZ_ROADS} Azərbaycan Respublikasının Qanunu`)).toBe(true);
  });

  it("matches the same ruling written with an abbreviation, on the same date only", () => {
    const register = lead({
      kind: "court",
      source: "e-qanun.az",
      date: "2026-10-20",
      title:
        "Azərbaycan Respublikası Konstitusiyasının 28 və 60-cı maddələri baxımından Azərbaycan Respublikası Cinayət-Prosessual Məcəlləsinin 157.1-ci maddəsinin həmin Məcəllənin 156.1, 346.1 və 447.5-ci maddələri ilə əlaqəli şəkildə şərh edilməsinə dair",
    });
    const court = lead({
      kind: "court",
      source: "constcourt.gov.az",
      date: "2026-10-20",
      title:
        "Azərbaycan Respublikası Konstitusiyasının 28 və 60-cı maddələri baxımından Azərbaycan Respublikası CPM-in 157.1-ci maddəsinin həmin Məcəllənin 156.1, 346.1 və 447.5-ci maddələri ilə əlaqəli şəkildə şərh edilməsinə dair",
    });
    expect(sameAct(register, court)).toBe(true);
    expect(sameAct(register, { ...court, date: "2026-10-26" })).toBe(false);
  });

  it("trusts numbers over titles", () => {
    expect(sameAct(lead({ number: "485-VIIQ" }), lead({ number: "№ 485-viiq" }))).toBe(true);
    expect(sameAct(lead({ number: "485-VIIQ" }), lead({ number: "486-VIIQ" }))).toBe(false);
  });

  it("spots a decree's annex posted as its own article", () => {
    expect(
      isAnnex(
        "“Daşınmaz Əmlakın Elektron Reyestri və Kadastrı” informasiya sistemi haqqında ƏSASNAMƏ Azərbaycan Respublikası Prezidentinin 2026-cı il 28 oktyabr tarixli Fərmanı ilə təsdiq edilmişdir"
      )
    ).toBe(true);
    expect(isAnnex("Səhiyyə sahəsində idarəetmənin təkmilləşdirilməsi ilə bağlı bir sıra tədbirlər haqqında")).toBe(false);
  });
});

describe("mergeLeads", () => {
  it("never merges two items from the same source", () => {
    const merged = mergeLeads([], [lead({}), lead({ title: KYRGYZ_FUND }), lead({})]);
    expect(merged).toHaveLength(3);
  });

  it("folds another source's copy in and fills what was missing", () => {
    const register = lead({ kind: "decree", source: "e-qanun.az", number: "804", title: "Səhiyyə sahəsində tədbirlər haqqında" });
    const president = lead({
      kind: "decree",
      title: "Səhiyyə sahəsində tədbirlər haqqında Azərbaycan Respublikası Prezidentinin Fərmanı",
      textUrl: "https://president.az/az/articles/view/74168",
    });
    const merged = mergeLeads([register], [president]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ number: "804", source: "e-qanun.az", textUrl: "https://president.az/az/articles/view/74168" });
  });
});

describe("enrichLaws", () => {
  it("keeps the signing date and adds the number and adoption date", () => {
    const signed = [lead({ date: "2026-10-21" }), lead({ date: "2026-10-21", title: KYRGYZ_FUND })];
    const adopted = [
      lead({ source: "meclis.gov.az", date: "2026-10-13", number: "485-VIIQ" }),
      lead({ source: "meclis.gov.az", date: "2026-10-13", number: "486-VIIQ", title: KYRGYZ_FUND }),
    ];
    expect(enrichLaws(signed, adopted).map((l) => [l.date, l.actDate, l.number])).toEqual([
      ["2026-10-21", "2026-10-13", "485-VIIQ"],
      ["2026-10-21", "2026-10-13", "486-VIIQ"],
    ]);
  });
});
