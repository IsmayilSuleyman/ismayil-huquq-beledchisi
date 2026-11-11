#!/usr/bin/env node
/**
 * Omni Law Gazette — clause reader for the local routine.
 *
 * Runs on İsmayıl's own computer, never in the cloud: it opens an act's
 * page on e-qanun.az in a real Chrome, as a person would, and copies one
 * clause of the consolidated text. The register's text files are closed
 * to scripts, and the cloud routine respects that; a browser on the
 * owner's machine reading a public page is what he does by hand.
 *
 *   npm run gazette:clause -- --framework 46944 --ref "7.5"
 *   npm run gazette:clause -- --url https://e-qanun.az/framework/46944 --ref "239" --json
 *   npm run gazette:clause -- --framework 46944 --dump > act.txt
 *   npm run gazette:clause -- --framework 897 --dump --html act.html > act.txt
 *
 * --ref is the clause or article number as the act numbers it ("7.5",
 * "239", "1.2.4-1", "Maddə 239"); the clause runs from that number at the
 * start of a line to the next sibling or higher-level number. --dump
 * prints the whole text instead. --json prints {ref, text, url, versionNote}.
 * --html <file> also saves the HTML of the frame that holds the text, from
 * the same page load: the endnote links (#_edn…) and the struck or bold
 * runs are in the HTML, not in the text.
 * Uses the installed Chrome (Playwright's "chrome" channel); pass
 * --headed to watch it. One page per call; be gentle with the site.
 */

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const { values } = parseArgs({
  options: {
    framework: { type: "string" },
    url: { type: "string" },
    ref: { type: "string" },
    dump: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
    html: { type: "string" },
    headed: { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(2);
}

const url = values.url ?? (values.framework ? `https://e-qanun.az/framework/${values.framework}` : null);
if (!url) fail("Give --framework <id> or --url <e-qanun framework link>");
if (!values.dump && !values.ref) fail("Give --ref <clause number> or --dump");

/** The clause that starts with `ref` at a line start, up to the next number of the same or a higher level. */
export function clause(text: string, ref: string): string | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const number = ref.replace(/^Maddə\s+/i, "").replace(/\.$/, "");
  const esc = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = new RegExp(`^(Maddə\\s+)?${esc}[.\\s]`, "i");
  const levels = number.split(".").length;
  // The next clause: a number with as many or fewer dotted parts than ours.
  const sibling = new RegExp(`^(Maddə\\s+)?\\d+(-\\d+)?(\\.\\d+(-\\d+)?){0,${Math.max(0, levels - 1)}}[.\\s]`, "i");
  const i = lines.findIndex((l) => start.test(l));
  if (i < 0) return null;
  const out = [lines[i]];
  for (let j = i + 1; j < lines.length; j++) {
    if (sibling.test(lines[j]) && !start.test(lines[j])) break;
    out.push(lines[j]);
  }
  return out.join("\n");
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: !values.headed });
  try {
    const page = await browser.newPage({ locale: "az-AZ" });
    await page.goto(url!, { waitUntil: "networkidle", timeout: 90_000 });
    // The text is rendered into the page (or an iframe) once the file loads; wait for a body with real length.
    let text = "";
    let frame = page.mainFrame();
    for (let tries = 0; tries < 30 && text.length < 500; tries++) {
      await page.waitForTimeout(1000);
      const frames = page.frames();
      const texts = await Promise.all(frames.map((f) => f.evaluate(() => document.body?.innerText ?? "").catch(() => "")));
      const longest = texts.reduce((best, t, i) => (t.length > texts[best].length ? i : best), 0);
      text = texts[longest] ?? "";
      frame = frames[longest] ?? frame;
    }
    if (text.length < 500) fail("The page showed no text; open it in Chrome yourself to see why");
    if (values.html) {
      const html = await frame.evaluate(() => document.documentElement.outerHTML);
      writeFileSync(values.html, html, "utf8");
      console.error(`Saved the HTML of ${frame.url()} to ${values.html}`);
    }
    const versionNote = /Qüvvədədir|Qüvvədən düşüb|Redaksiya/i.test(text) ? (text.match(/[^\n]*(Qüvvədədir|Qüvvədən düşüb)[^\n]*/)?.[0] ?? "") : "";
    if (values.dump) {
      console.log(text);
      return;
    }
    const found = clause(text, values.ref!);
    if (!found) fail(`Clause ${values.ref} not found in the page's text (use --dump to see it)`);
    if (values.json) console.log(JSON.stringify({ ref: values.ref, text: found, url, versionNote }));
    else console.log(found);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
