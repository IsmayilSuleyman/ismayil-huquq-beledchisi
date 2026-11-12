#!/usr/bin/env node
/**
 * Builds the earlier wordings of an act (content/versions/<slug>.json) and a
 * report of the checks (scripts/versions/reports/<slug>.md).
 *
 *   npm run versions:build -- --act konstitusiya
 *   npm run versions:build -- --act konstitusiya --html saved-page.html
 *
 * The act's e-qanun page is read once in Chrome on İsmayıl's computer and
 * saved (npm run gazette:clause -- --framework 897 --dump --html page.html);
 * --html takes that saved page, cleans it and stores it as the act's source
 * (scripts/versions/acts/<slug>.ts names the file). Without --html the
 * stored source is used, so the build runs anywhere, cloud included.
 *
 * Starting from the text in force, each article is stepped back through the
 * amendments, newest first (rebuild.ts), using e-qanun's endnotes or the
 * amending act's own text (changes.ts). The build stops if a change
 * sentence cannot be read or an operation cannot be undone; the report
 * lists every place the rebuilt text differs from the text as published.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { readAmendingAct, readEndnote, type Op } from "@/scripts/versions/changes";
import type { ActConfig } from "@/scripts/versions/config";
import { cleanEqanunHtml, parseEqanun, stripMarks } from "@/scripts/versions/eqanun-html";
import { copy, readable, RebuildError, undo, type Snapshot } from "@/scripts/versions/rebuild";
import { readStructure } from "@/scripts/versions/structure";
import { diffWords, normalize, sameWording } from "@/lib/versions/diff";
import type { ArticleHistory, ArticleVersion, VersionedAct } from "@/lib/versions/types";

const { values } = parseArgs({
  options: {
    act: { type: "string" },
    html: { type: "string" },
  },
});

if (!values.act) {
  console.error("✗ Give --act <slug> (scripts/versions/acts/<slug>.ts)");
  process.exit(2);
}

const config = (await import(`@/scripts/versions/acts/${values.act}`)).default as ActConfig;

type Change = { amendment: string; text: string; ops: Op[] };

function write(file: string, text: string) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

type WitnessFile = { source: string; articles: Record<string, Snapshot & { pages?: string[] }> };

function loadWitness(file: string): WitnessFile {
  return JSON.parse(readFileSync(file, "utf8")) as WitnessFile;
}

/** A compact word diff for the report: [-removed-] {+added+}. */
function reportDiff(a: string, b: string): string {
  return diffWords(normalize(a), normalize(b))
    .map((p) => (p.kind === "same" ? (p.text.length > 80 ? `${p.text.slice(0, 30)} … ${p.text.slice(-30)}` : p.text) : p.kind === "del" ? `[-${p.text.trim()}-]` : `{+${p.text.trim()}+}`))
    .join("")
    .replace(/\n/g, " ¶ ");
}

function asText(snap: Snapshot): string {
  return [snap.title, ...snap.paragraphs].join("\n");
}

async function main() {
  const raw = readFileSync(values.html ?? config.sources.eqanun, "utf8");
  const clean = cleanEqanunHtml(raw);
  if (values.html) write(config.sources.eqanun, clean);
  const doc = parseEqanun(clean);
  const act = readStructure(doc.body);

  const problems: string[] = [];
  const notes: string[] = [];

  // ── The changes, by amendment and article ────────────────────────────────
  const byAmendment = new Map<string, Map<string, Change[]>>();
  const add = (amendment: string, article: string, change: Change) => {
    const map = byAmendment.get(amendment) ?? new Map<string, Change[]>();
    byAmendment.set(amendment, map);
    map.set(article, [...(map.get(article) ?? []), change]);
  };
  const fromNotes = config.amendments.filter((a) => a.from === "endnotes").map((a) => ({ id: a.id, number: a.decisionNumber }));
  let noteOps = 0;
  for (const note of doc.endnotes) {
    for (const change of readEndnote(note.text, fromNotes)) {
      if (change.unread.length) problems.push(`Endnote ${note.label}: could not read “${change.unread.join("”, “")}”`);
      if (!change.ops.length) problems.push(`Endnote ${note.label}: no operation in “${change.sentence}”`);
      noteOps += change.ops.length;
      const articles = new Set(change.ops.map((op) => op.scope.article));
      for (const article of articles) {
        add(change.act, article, { amendment: change.act, text: change.sentence.replace(/\.$/, ""), ops: change.ops.filter((op) => op.scope.article === article) });
      }
    }
  }
  let actOps = 0;
  for (const amendment of config.amendments.filter((a) => a.from === "act")) {
    const file = config.sources.acts[amendment.id];
    const text = readFileSync(file, "utf8");
    for (const item of readAmendingAct(text)) {
      if (item.unread.length) problems.push(`${amendment.id} act, item ${item.item}: could not read “${item.unread.join("”, “")}”`);
      actOps += item.ops.length;
      const articles = new Set(item.ops.map((op) => op.scope.article));
      for (const article of articles) {
        add(amendment.id, article, { amendment: amendment.id, text: item.sentence.replace(/\s*\n\s*/g, " ").replace(/\.$/, ""), ops: item.ops.filter((op) => op.scope.article === article) });
      }
    }
  }
  notes.push(`Operations read: ${noteOps} from e-qanun's endnotes, ${actOps} from amending acts.`);

  const witnesses = new Map<string, WitnessFile>();
  for (const [id, w] of Object.entries(config.sources.witnesses)) witnesses.set(id, loadWitness(w.file));

  // ── Each article, stepped back ───────────────────────────────────────────
  const articles: Record<string, ArticleHistory> = {};
  const witnessReport: string[] = [];
  const amendments = config.amendments;
  for (const source of act.articles) {
    const now: Snapshot = { title: source.title, paragraphs: source.paragraphs.map((p) => p.text) };
    // states[i] = the article after amendment i; states[-1] (index 0 here) = as adopted.
    const after: (Snapshot | null)[] = new Array(amendments.length).fill(null);
    let snap: Snapshot | null = copy(now);
    let original: Snapshot | null = null;
    const changesBy: Record<string, string[]> = {};
    for (let i = amendments.length - 1; i >= 0; i--) {
      after[i] = snap ? copy(snap) : null;
      const amendment = amendments[i];
      const changes = byAmendment.get(amendment.id)?.get(source.number) ?? [];
      if (!snap || !changes.length) continue;
      changesBy[amendment.id] = changes.map((c) => c.text);
      const ops = changes.flatMap((c) => c.ops);
      if (ops.some((op) => op.kind === "addArticle")) {
        snap = null;
        continue;
      }
      const witness = witnesses.get(amendment.id)?.articles[source.number];
      // Newest operation first; unquoted added words last, so the italics of a word swap in the same item are still there for the swap.
      const order = [...ops].reverse().sort((a, b) => Number(a.kind === "addWords") - Number(b.kind === "addWords"));
      for (const original of order) {
        let op = original;
        for (const alias of config.quotes.filter((q) => q.amendment === amendment.id && q.article === source.number)) {
          const json = JSON.stringify(op);
          const swapped = json.split(JSON.stringify(alias.quote)).join(JSON.stringify(alias.text));
          if (swapped === json) continue;
          op = JSON.parse(swapped) as Op;
          notes.push(`Article ${alias.article}, ${alias.amendment}: ${alias.reason}`);
        }
        try {
          undo(snap, op, witness);
        } catch (e) {
          if (e instanceof RebuildError) problems.push(`${amendment.id}: ${e.message}`);
          else throw e;
        }
      }
      for (const fix of config.fixes.filter((f) => f.article === source.number && f.before === amendment.id)) {
        const text = snap.paragraphs.join("\n");
        if (!text.includes(fix.find)) problems.push(`Fix for article ${fix.article} before ${fix.before}: “${fix.find}” not found`);
        snap.paragraphs = text.replace(fix.find, fix.replace).split("\n");
        notes.push(`Article ${fix.article}, before ${fix.before}: ${fix.reason}`);
      }
      // The witness of the text before this amendment, as published (only when no earlier amendment changed the article).
      const earlier = amendments.slice(0, i).some((e) => byAmendment.get(e.id)?.has(source.number));
      if (witness && !earlier) {
        const rebuilt = readable(snap);
        const same = sameWording(asText(rebuilt), asText(witness));
        if (!same) witnessReport.push(`- Article ${source.number}, before ${amendment.id} (${(witness.pages ?? []).join(", ")}): ${reportDiff(asText(witness), asText(rebuilt))}`);
      }
    }
    original = snap;
    if (original && /[-]/.test([original.title, ...original.paragraphs].join(""))) {
      const left = [original.title, ...original.paragraphs].join("\n").match(/[][^]*[]/g) ?? [];
      problems.push(`Article ${source.number}: marked words left after undoing every amendment (a change no note explains): ${left.map((l) => `“${stripMarks(l).slice(0, 60)}”`).join(", ")}`);
    }

    // Versions, oldest first, one per wording that differs from the one before.
    const versions: ArticleVersion[] = [];
    const push = (id: string, date: string, s: Snapshot | null, changes?: string[]) => {
      if (!s) return;
      const r = readable(s);
      const last = versions[versions.length - 1];
      if (last && last.title === r.title && last.paragraphs.join("\n") === r.paragraphs.join("\n")) return;
      if (last) last.to = date;
      versions.push({ act: id, from: date, to: null, title: r.title, paragraphs: r.paragraphs, ...(changes?.length ? { changes } : {}) });
    };
    push(config.original.id, config.original.date, original);
    amendments.forEach((a, i) => push(a.id, a.date, after[i], changesBy[a.id]));
    articles[source.number] = { number: source.number, versions };
  }

  // ── Output ───────────────────────────────────────────────────────────────
  const data: VersionedAct = {
    slug: config.slug,
    title: config.title,
    short: config.short,
    eqanunId: config.eqanunId,
    intro: act.intro,
    preamble: act.preamble,
    original: config.original,
    amendments: amendments.map(({ id, label, referendum, date, decision, act: a }) => ({ id, label, referendum, date, decision, act: a })),
    outline: act.outline.map((o) => (o.kind === "article" ? { kind: "article" as const, number: o.number } : { kind: o.heading.kind, label: o.heading.label, title: o.heading.title })),
    articles,
    closing: act.closing,
    sources: [
      `Qüvvədə olan mətn və 2009, 2016-cı il dəyişiklikləri: e-qanun.az, ${config.eqanunId} nömrəli sənəd və onun qeydləri.`,
      ...amendments.filter((a) => a.from === "act").map((a) => `${a.label}: ${a.act.title}${a.act.eqanunId ? ` (e-qanun.az, ${a.act.eqanunId})` : ""}.`),
      ...[...new Set(Object.values(config.sources.witnesses).map((w) => w.label))].map((l) => `Əvvəlki redaksiyanın dəyişikliyə qədər çap olunmuş mətni: ${l}, e-qanun.az-da sənədin şəkilləri.`),
    ],
  };
  const out = `content/versions/${config.slug}.json`;
  write(out, `${JSON.stringify(data, null, 1)}\n`);

  const changed = Object.values(articles).filter((a) => a.versions.length > 1 || a.versions[0]?.act !== config.original.id);
  const perAmendment = amendments.map((a) => {
    const list = Object.values(articles).filter((h) => h.versions.some((v) => v.act === a.id)).map((h) => h.number);
    return `- ${a.label}: ${list.length} articles — ${list.join(", ")}`;
  });
  const numbered = act.articles.filter((a) => !a.number.includes("-")).length;
  const inserted = act.articles.filter((a) => a.number.includes("-")).map((a) => a.number);
  const report = [
    `# ${config.title}: versions build report`,
    "",
    "Generated by `npm run versions:build -- --act " + config.slug + "`. Do not edit by hand.",
    "",
    "## Counts",
    "",
    `- Articles in the text in force: ${act.articles.length} (numbered 1–${numbered}, plus ${inserted.length} inserted: ${inserted.join(", ")}).`,
    `- Articles with more than one wording, or added later: ${changed.length}.`,
    ...perAmendment,
    "",
    "## Notes",
    "",
    ...notes.map((n) => `- ${n}`),
    "",
    "## Problems",
    "",
    ...(problems.length ? problems.map((p) => `- ${p}`) : ["None."]),
    "",
    "## Rebuilt text against the text as published",
    "",
    "Each line is an article whose rebuilt wording differs from the published one: [-published only-] {+rebuilt only+}. Quotes, dashes and spacing are evened out first.",
    "",
    ...(witnessReport.length ? witnessReport : ["No differences."]),
    "",
  ].join("\n");
  write(`scripts/versions/reports/${config.slug}.md`, report);
  console.log(`✓ ${out}: ${act.articles.length} articles, ${changed.length} with earlier wordings`);
  console.log(`  ${problems.length} problems, ${witnessReport.length} differences from the published text (scripts/versions/reports/${config.slug}.md)`);
  if (problems.length) process.exitCode = 1;
}

await main();
