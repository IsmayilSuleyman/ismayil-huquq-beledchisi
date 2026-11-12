/**
 * Reads the sentences that describe a change to an act, in the two forms
 * Azerbaijani legislation uses: an e-qanun endnote, in the past tense
 *
 *   "… Qərarı (…) ilə 19-cu maddənin II hissəsində "Milli" sözü "Mərkəzi"
 *    sözü ilə əvəz edilmişdir."
 *
 * and the amending act itself, in the imperative
 *
 *   "IV. 76-cı maddənin II hissəsində «alternativ hərbi xidmətlə» sözləri
 *    «alternativ xidmətlə» sözləri ilə əvəz edilsin."
 *
 * into a list of operations on the act's articles (Op). The grammar is the
 * one the drafting rules give these texts: a target (article, part, item,
 * sentence, paragraph, title, text) followed by what happens to it (words
 * replaced, added after a word, removed; a part, item or sentence added; a
 * unit given a new wording; parts renumbered). Quoted strings are the words
 * themselves. Anything the scanner cannot read is returned in `unread`, so
 * the build can stop and say which sentence it did not understand.
 */

export type Scope = {
  article: string;
  /** The article's title ("adı", "adında"). */
  title?: boolean;
  /** Parts by their label ("II"); none means the whole article. */
  parts?: string[];
  /** Item ("bənd", "yarımbənd") by number, within the part or article. */
  item?: string;
  /** Several items ("6-cı və 19-cu bəndləri"). */
  items?: string[];
  /** Sentence of the unit, 1-based. */
  sentence?: number;
  /** Paragraph ("abzas") of the part, 1-based. */
  paragraph?: number;
  /** The whole article, title included ("60-cı maddə yeni redaksiyada"). */
  whole?: boolean;
};

export type Op =
  | { kind: "replace"; scope: Scope; old: string; new: string }
  | { kind: "insert"; scope: Scope; after: string; words: string }
  | { kind: "remove"; scope: Scope; words: string }
  /** Words added without being quoted ("bəndə yeni sözlər əlavə edilmişdir"): the italics show them. */
  | { kind: "addWords"; scope: Scope }
  | { kind: "addParts"; scope: Scope; labels: string[]; text?: string[] }
  | { kind: "addItems"; scope: Scope; labels: string[]; text?: string[] }
  | { kind: "addSentence"; scope: Scope; ordinal?: number }
  | { kind: "addArticle"; scope: Scope; text?: string[] }
  /** A unit given a new wording: `old` from an endnote, `text` from an amending act. */
  | { kind: "newText"; scope: Scope; old?: string[]; text?: string[] }
  | { kind: "rename"; scope: Scope; title: string }
  | { kind: "renumberParts"; scope: Scope; from: string[]; to: string[] }
  | { kind: "renumberItems"; scope: Scope; from: string[]; to: string[] }
  /** "maddənin mövcud mətni I hissə hesab edilmişdir": the unnumbered text becomes part I. */
  | { kind: "textToPart"; scope: Scope; label: string }
  | { kind: "removeItems"; scope: Scope; labels: string[] }
  | { kind: "removeParagraphs"; scope: Scope; paragraphs: number[] }
  /** "sonunda nöqtə işarəsi nöqtəli vergül işarəsi ilə əvəz edilmişdir". */
  | { kind: "endPunctuation"; scope: Scope; old: string; new: string };

export type ReadChange = { ops: Op[]; unread: string[] };

const ORDINAL: Record<string, number> = {
  birinci: 1,
  ikinci: 2,
  üçüncü: 3,
  dördüncü: 4,
  beşinci: 5,
  altıncı: 6,
  yeddinci: 7,
  səkkizinci: 8,
};
const ORD = Object.keys(ORDINAL).join("|");
const NUM = String.raw`(\d+(?:-1)?)-(?:ci|cı|cu|cü)`;
const ROMAN = String.raw`[IVXL]+`;
const ROMAN_LIST = String.raw`${ROMAN}(?:,\s*${ROMAN})*(?:\s+və\s+${ROMAN})?`;
const DONE = String.raw`(?:edilmişdir|edilsin|edilib)`;
const Q = "(\\d+)";
const END = String.raw`(?=[\s,.;:]|$)`;
const WORD = String.raw`(?:sözü|sözləri|söz|rəqəmi|rəqəmləri|ifadəsi|işarəsi)`;

const QUOTE_PAIRS: Record<string, string> = { '"': '"', "“": "”", "«": "»", "„": "“" };

/** Replaces each quoted string with a placeholder; returns the text and the quotes. */
export function liftQuotes(text: string): { text: string; quotes: string[] } {
  const quotes: string[] = [];
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const close = QUOTE_PAIRS[ch];
    if (close) {
      // Nested «…» inside «…» is kept inside the outer quote.
      let depth = 1;
      let j = i + 1;
      for (; j < text.length; j++) {
        if (text[j] === ch && ch !== close) depth++;
        else if (text[j] === close) {
          depth--;
          if (depth === 0) break;
        }
      }
      if (j < text.length) {
        quotes.push(text.slice(i + 1, j));
        out += `${quotes.length - 1}`;
        i = j + 1;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return { text: out, quotes };
}

function romans(list: string): string[] {
  return list.split(/,\s*|\s+və\s+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Reads one change sentence (the part after "… Qərarı (…) ilə", or one
 * numbered item of an amending act). `article` is the article in scope when
 * the sentence starts without naming one (an amending act's bullet lines).
 */
export function readChange(sentence: string, article?: string): ReadChange {
  const { text, quotes } = liftQuotes(sentence);
  const ops: Op[] = [];
  const unread: string[] = [];
  const q = (n: string) => quotes[Number(n)];
  let scope: Scope = { article: article ?? "" };
  let articles: string[] = article ? [article] : [];
  // Quoted texts after a colon belong to the op before the colon (an act's new wording).
  let wantsText: Op | null = null;

  const push = (op: Op) => {
    for (const a of articles.length > 1 ? articles : [op.scope.article]) ops.push({ ...op, scope: { ...op.scope, article: a } } as Op);
  };
  const at = (fields: Partial<Scope>): Scope => ({ article: scope.article, ...fields });

  type Rule = [RegExp, (m: RegExpExecArray) => void];
  const rules: Rule[] = [
    // Connectors and punctuation between instructions.
    [/^(?:,|;|:|\.|-|–|və|isə|habelə|müvafiq olaraq,?|bu maddənin)\s*/, () => {}],
    // A new article.
    [new RegExp(`^(?:yeni|aşağıdakı) (?:məzmunda|redaksiyada) ${NUM} maddə əlavə ${DONE}`), (m) => {
      const op: Op = { kind: "addArticle", scope: { article: m[1] } };
      ops.push(op);
      wantsText = op;
    }],
    // Several articles at once ("95-ci, 109-cu və 125-ci maddələrdə").
    [new RegExp(`^((?:\\d+-(?:ci|cı|cu|cü),?\\s+)+və\\s+\\d+-(?:ci|cı|cu|cü))\\s+maddələrdə`), (m) => {
      articles = [...m[1].matchAll(/(\d+)-/g)].map((x) => x[1]);
      scope = { article: articles[0] };
    }],
    // "60-cı maddə yeni redaksiyada" / "132-ci maddə aşağıdakı redaksiyada": the whole article.
    [new RegExp(`^${NUM} maddə (?=(?:yeni|aşağıdakı) redaksiyada)`), (m) => {
      articles = [m[1]];
      scope = { article: m[1], whole: true };
    }],
    // "17-ci maddə "…" adlandırılmışdır".
    [new RegExp(`^${NUM} maddə (?=${Q} adlandırıl)`), (m) => {
      articles = [m[1]];
      scope = { article: m[1] };
    }],
    [new RegExp(`^${NUM} maddə(?:nin|də|yə|dən|si)?${END}`), (m) => {
      articles = [m[1]];
      scope = { article: m[1] };
    }],
    [/^(?:həmin |)maddə(?:yə|də)(?=[\s,.;:]|$)/, () => {
      scope = at({});
    }],
    [/^(?:maddənin |)(?:adında|adı)(?=[\s,.;:]|$)/, () => {
      scope = at({ title: true });
    }],
    [new RegExp(`^(?:maddənin |)(?:mövcud |)mətni (${ROMAN}) hissə hesab ${DONE}`), (m) => {
      push({ kind: "textToPart", scope: at({}), label: m[1] });
    }],
    [/^(?:maddənin |)mətnində(?=[\s,.;:]|$)/, () => {
      scope = at({});
    }],
    [/^(?:maddənin |)mətni(?=[\s,.;:]|$)/, () => {
      scope = at({});
    }],
    // Renumbering: "I və II hissələr, müvafiq olaraq, II və III hissələr hesab edilmişdir".
    [new RegExp(`^(${ROMAN_LIST}) hissə(?:lər)?,? (?:müvafiq olaraq,? )?(${ROMAN_LIST}) hissə(?:lər)? hesab ${DONE}`), (m) => {
      push({ kind: "renumberParts", scope: at({}), from: romans(m[1]), to: romans(m[2]) });
    }],
    [new RegExp(`^${NUM} və ${NUM} bəndlər,? müvafiq olaraq,? ${NUM} və ${NUM} bəndlər hesab ${DONE}`), (m) => {
      push({ kind: "renumberItems", scope: { ...scope }, from: [m[1], m[2]], to: [m[3], m[4]] });
    }],
    // Additions.
    [new RegExp(`^(?:yeni|aşağıdakı) (?:məzmunda|redaksiyada) (${ROMAN_LIST}) hissə(?:lər)? əlavə ${DONE}`), (m) => {
      const op: Op = { kind: "addParts", scope: at({}), labels: romans(m[1]) };
      push(op);
      wantsText = ops[ops.length - 1];
    }],
    [new RegExp(`^(?:yeni|aşağıdakı) (?:məzmunda|redaksiyada) ${NUM}(?: və ${NUM})? (?:yarım)?bənd(?:lər)? əlavə ${DONE}`), (m) => {
      push({ kind: "addItems", scope: { ...scope, item: undefined }, labels: [m[1], m[2]].filter(Boolean) as string[] });
      wantsText = ops[ops.length - 1];
    }],
    [new RegExp(`^(?:yeni|aşağıdakı) (?:məzmunda|redaksiyada) (?:(${ORD}) )?cümlə əlavə ${DONE}`), (m) => {
      push({ kind: "addSentence", scope: { ...scope }, ordinal: m[1] ? ORDINAL[m[1]] : undefined });
    }],
    [new RegExp(`^yeni sözlər əlavə ${DONE}`), () => {
      push({ kind: "addWords", scope: { ...scope } });
    }],
    // A new wording.
    [new RegExp(`^(?:yeni|aşağıdakı) redaksiyada veril(?:mişdir|sin|ib)`), () => {
      push({ kind: "newText", scope: { ...scope } });
      wantsText = ops[ops.length - 1];
    }],
    [new RegExp(`^${Q} adlandırıl(?:mışdır|sın)`), (m) => {
      push({ kind: "rename", scope: at({ title: true }), title: q(m[1]) });
    }],
    // Words.
    [new RegExp(`^${Q} ${WORD} (?:isə )?${Q} ${WORD} ilə(?: əvəz ${DONE})?`), (m) => {
      push({ kind: "replace", scope: { ...scope }, old: q(m[1]), new: q(m[2]) });
    }],
    [new RegExp(`^${Q} (?:sözündən|sözlərindən|rəqəmindən|ifadəsindən) sonra ${Q} ${WORD}(?: əlavə ${DONE})?`), (m) => {
      push({ kind: "insert", scope: { ...scope }, after: q(m[1]), words: q(m[2]) });
    }],
    [new RegExp(`^${Q} ${WORD} çıxarıl(?:mışdır|sın)`), (m) => {
      push({ kind: "remove", scope: { ...scope }, words: q(m[1]) });
    }],
    [/^sonunda nöqtə işarəsi nöqtəli vergül işarəsi ilə əvəz (?:edilmişdir|edilsin)/, () => {
      push({ kind: "endPunctuation", scope: { ...scope }, old: ".", new: ";" });
    }],
    // Units removed.
    [new RegExp(`^${NUM}(?: və ${NUM})? bənd(?:i|ləri|lər)? çıxarıl(?:mışdır|sın)`), (m) => {
      push({ kind: "removeItems", scope: { ...scope, item: undefined }, labels: [m[1], m[2]].filter(Boolean) as string[] });
    }],
    [new RegExp(`^((?:(?:${ORD}),?\\s+)*(?:və\\s+)?(?:${ORD})) abzaslar? çıxarıl(?:mışdır|sın)`), (m) => {
      push({ kind: "removeParagraphs", scope: { ...scope, paragraph: undefined }, paragraphs: m[1].split(/,\s*|\s+və\s+|\s+/).filter((w) => ORDINAL[w]).map((w) => ORDINAL[w]) });
    }],
    // Targets inside an article.
    [new RegExp(`^(${ROMAN_LIST}) hissə(?:si|sinin|sində|sinə|sindən|nin|lərinə|lərində|ləri|yə|də|dən)?${END}`), (m) => {
      scope = at({ parts: romans(m[1]) });
    }],
    [/^həmin hissə(?:yə|də|dən)(?=[\s,.;:]|$)/, () => {}],
    [/^həmin bənd(?:ə|də)(?=[\s,.;:]|$)|^bəndə(?=[\s,.;:]|$)/, () => {}],
    [new RegExp(`^(?:${ORD}) bənd(?:inin|ində|i)${END}`), () => {
      // "I hissəsinin birinci bəndinin 5-ci yarımbəndi": the items are numbered within the part.
    }],
    [new RegExp(`^${NUM} və ${NUM} (?:yarım)?bənd(?:ləri|lərində)${END}`), (m) => {
      scope = { ...scope, item: undefined, items: [m[1], m[2]], sentence: undefined };
    }],
    [new RegExp(`^${NUM} (?:yarım)?bənd(?:i|inin|ində|inə|də|ə|ləri)?${END}`), (m) => {
      scope = { ...scope, item: m[1], sentence: undefined };
    }],
    [new RegExp(`^(${ORD}) cümlə(?:si|sində|sinə)${END}`), (m) => {
      scope = { ...scope, sentence: ORDINAL[m[1]] };
    }],
    [new RegExp(`^(${ORD}) abzas(?:ı|ında|ına)${END}`), (m) => {
      scope = { ...scope, paragraph: ORDINAL[m[1]] };
    }],
    // Quoted new wording after a colon (an amending act): it belongs to the op before it.
    [new RegExp(`^${Q}\\s*[.;]?`), (m) => {
      const target = wantsText as { kind: string; text?: string[] } | null;
      if (target && ["addParts", "addItems", "addArticle", "newText"].includes(target.kind)) {
        target.text = [...(target.text ?? []), q(m[1])];
      } else unread.push(`stray quote: ${q(m[1]).slice(0, 60)}`);
    }],
  ];

  let rest = text.replace(/\s+/g, " ").trim();
  while (rest) {
    let matched = false;
    for (const [re, handle] of rules) {
      const m = re.exec(rest);
      if (m && m[0].length > 0) {
        handle(m);
        rest = rest.slice(m[0].length).trimStart();
        matched = true;
        break;
      }
    }
    if (!matched) {
      const word = rest.split(" ")[0];
      unread.push(rest.slice(0, 80).replace(/(\d+)/g, (_, n) => `"${q(n).slice(0, 30)}"`));
      rest = rest.slice(word.length).trimStart();
      // Skip to the next connector so one unknown word does not hide the rest.
      const next = rest.search(/(?:,|;| və )/);
      rest = next >= 0 ? rest.slice(next) : "";
    }
  }
  return { ops, unread };
}

/** The amending acts an endnote cites, keyed by a pattern of their number ("20/83"). */
export type ActKey = { id: string; number: string };

export type EndnoteChange = {
  act: string;
  /** The sentence as the endnote has it. */
  sentence: string;
  ops: Op[];
  unread: string[];
};

/**
 * Finds the change sentences in an endnote ("… nömrəli … Qərarı (…) ilə …
 * edilmişdir.") and reads each one. An endnote that also holds other notes
 * (a Constitutional Court interpretation) keeps only the change sentences.
 * The old wording after "Əvvəlki redaksiyada deyilirdi:" goes to the
 * sentence's newText op.
 */
export function readEndnote(text: string, acts: ActKey[]): EndnoteChange[] {
  const out: EndnoteChange[] = [];
  const [main, ...oldParts] = text.split(/Əvvəlki redaksiyada deyilirdi:\s*/);
  const old = oldParts.join("\n").split("\n").map((l) => l.trim()).filter(Boolean);
  const re = /(\d{1,2} [a-zəöüçşığ]+ \d{4}-[a-zıü]+ il(?: tarixli)? ([\d/A-Za-z-]+) nömrəli[^\n]*?\)\s*ilə\s+)([^\n]*?\.)(?=\s*$|\s*\n)/gim;
  for (const m of main.matchAll(re)) {
    const act = acts.find((a) => a.number === m[2]);
    if (!act) continue;
    const read = readChange(m[3]);
    for (const op of read.ops) if (op.kind === "newText") op.old = old;
    out.push({ act: act.id, sentence: `${m[3]}`, ...read });
  }
  return out;
}

/**
 * Splits an amending act's text into its numbered items ("IV. 76-cı
 * maddənin …") and reads each, carrying the article into bullet lines.
 */
export function readAmendingAct(text: string): { item: string; sentence: string; ops: Op[]; unread: string[] }[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: { item: string; lines: string[] }[] = [];
  for (const line of lines) {
    const m = /^([IVXL]+|\d+)\.\s+(?=\d+-(?:ci|cı|cu|cü) maddə|\d+-(?:ci|cı|cu|cü), )/.exec(line);
    if (m) items.push({ item: m[1], lines: [line.slice(m[0].length)] });
    else if (items.length) items[items.length - 1].lines.push(line);
  }
  return items.map(({ item, lines: itemLines }) => {
    const sentence = itemLines.join("\n");
    const first = /^(\d+)-/.exec(sentence)?.[1];
    // Bullet lines ("- I hissənin …") continue the item's article.
    const parts = sentence.split(/\n(?=-\s)/);
    const ops: Op[] = [];
    const unread: string[] = [];
    for (const [k, part] of parts.entries()) {
      const read = readChange(part, k > 0 ? first : undefined);
      ops.push(...read.ops);
      unread.push(...read.unread);
    }
    return { item, sentence, ops, unread };
  });
}
