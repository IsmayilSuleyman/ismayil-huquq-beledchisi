/**
 * The Constitution: where its text and amendments come from.
 *
 * The 2009 and 2016 referendums are read from e-qanun's endnotes, which
 * record each change and quote any wording a new one replaced. The 2002
 * referendum is not annotated there (only Article 3, Part III has a note),
 * so its changes come from the 2002 Referendum Act itself (e-qanun 47432);
 * wordings that act replaced or deleted without quoting them come from the
 * 1995 text as published in Qanunvericilik Toplusu, 1997, № 1, scanned on
 * e-qanun's "Şəkil" tab and transcribed for the articles concerned.
 */

import type { ActConfig } from "@/scripts/versions/config";

const config: ActConfig = {
  slug: "konstitusiya",
  title: "Azərbaycan Respublikasının Konstitusiyası",
  short: "Konstitusiya",
  eqanunId: 897,
  original: {
    id: "1995",
    label: "1995-ci il 12 noyabr referendumu",
    date: "1995-11-27",
    note: "1995-ci il noyabrın 12-də ümumxalq səsverməsində (referendumda) qəbul edilib, 1995-ci il noyabrın 27-dən qüvvəyə minib.",
  },
  amendments: [
    {
      id: "2002",
      label: "2002-ci il 24 avqust referendumu",
      referendum: "2002-08-24",
      date: "2002-08-29",
      decision: "Mərkəzi Seçki Komissiyasının 29 avqust 2002-ci il tarixli 99/372 nömrəli qərarı",
      decisionNumber: "99/372",
      act: { title: "“Azərbaycan Respublikasının Konstitusiyasında dəyişikliklər edilməsi haqqında” Referendum Aktı", eqanunId: 47432 },
      from: "act",
    },
    {
      id: "2009",
      label: "2009-cu il 18 mart referendumu",
      referendum: "2009-03-18",
      date: "2009-03-30",
      decision: "Mərkəzi Seçki (Referendum) Komissiyasının 30 mart 2009-cu il tarixli 19/86 nömrəli qərarı",
      decisionNumber: "19/86",
      act: { title: "“Azərbaycan Respublikasının Konstitusiyasına əlavələr və dəyişikliklər edilməsi haqqında” Referendum Aktı", eqanunId: 47433 },
      from: "endnotes",
    },
    {
      id: "2016",
      label: "2016-cı il 26 sentyabr referendumu",
      referendum: "2016-09-26",
      date: "2016-10-11",
      decision: "Mərkəzi Seçki Komissiyasının 11 oktyabr 2016-cı il tarixli 20/83 nömrəli qərarı",
      decisionNumber: "20/83",
      act: { title: "“Azərbaycan Respublikasının Konstitusiyasında dəyişikliklər edilməsi haqqında” Referendum Aktı", eqanunId: 47434 },
      from: "endnotes",
    },
  ],
  sources: {
    eqanun: "content/versions/sources/konstitusiya/e-qanun-897.html",
    acts: { "2002": "content/versions/sources/konstitusiya/referendum-2002.txt" },
    witnesses: {
      // The text before the act, as published: what an act replaced without quoting.
      "2002": { file: "content/versions/sources/konstitusiya/toplusu-1997-1.json", label: "Qanunvericilik Toplusu, 1997, № 1 (1995-ci il mətni)" },
      "2009": { file: "content/versions/sources/konstitusiya/toplusu-1997-1.json", label: "Qanunvericilik Toplusu, 1997, № 1 (1995-ci il mətni)" },
      "2016": { file: "content/versions/sources/konstitusiya/toplusu-2009-3.json", label: "Qanunvericilik Toplusu, 2009, № 3 (2009-cu il mətni)" },
    },
  },
  fixes: [
    {
      article: "89",
      before: "2002",
      find: "5) özü imtina etdikdə.",
      replace: "5) özü imtina etdikdə:",
      reason: "the 1995 text, as printed in Toplusu 1997 № 1, ends item 5 of Part I with a colon; e-qanun's text ends it with a full stop because item 6 was removed in 2002.",
    },
  ],
  quotes: [
    {
      amendment: "2002",
      article: "96",
      quote: ", Azərbaycan Respublikası Prokurorluğuna",
      text: ", Azərbaycan Respublikasının Prokurorluğuna",
      reason: "the 2002 act adds “, Azərbaycan Respublikası Prokurorluğuna” to Part I; e-qanun's text prints “Respublikasının”.",
    },
  ],
};

export default config;
