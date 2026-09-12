import path from "node:path";
import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { SOURCES_ROOT, getSource, groupByKind, listSources } from "@/lib/sources";

const ROOT = path.join(__dirname, "fixtures", "sources");

describe("listSources / getSource", () => {
  it("lists mdx files ordered by `order`, skipping other files", async () => {
    const sources = await listSources(ROOT);
    expect(sources.map((s) => s.slug)).toEqual(["ikinci-akt", "test-akt"]);
    expect(sources[1]).toMatchObject({ kind: "Qanun", number: "1-TQ", official: "https://example.org/akt" });
    expect(sources[0]).toMatchObject({ number: null, official: null, summary: "" });
  });

  it("reads the body and rejects unsafe slugs", async () => {
    const s = await getSource("test-akt", ROOT);
    expect(s?.body).toContain("## Bölmə");
    expect(await getSource("../test-akt", ROOT)).toBeNull();
    expect(await getSource("missing", ROOT)).toBeNull();
    expect(await listSources(path.join(ROOT, "nope"))).toEqual([]);
  });

  it("groups by kind in order of first appearance", async () => {
    const groups = groupByKind(await listSources(ROOT));
    expect(groups.map((g) => g.kind)).toEqual(["Məcəllə", "Qanun"]);
  });
});

describe("content/sources", () => {
  it("every study material compiles as MDX and carries the fields the pages use", async () => {
    const sources = await listSources(SOURCES_ROOT);
    expect(sources.length).toBeGreaterThan(0);
    for (const meta of sources) {
      const s = (await getSource(meta.slug, SOURCES_ROOT))!;
      expect(s.summary.length, meta.slug).toBeGreaterThan(0);
      expect(s.official, meta.slug).toMatch(/^https:\/\//);
      await expect(compile(s.body, { remarkPlugins: [remarkGfm] }), `${meta.slug} should compile`).resolves.toBeDefined();
    }
    const orders = sources.map((s) => s.order);
    expect(new Set(orders).size).toBe(orders.length);
  });
});
