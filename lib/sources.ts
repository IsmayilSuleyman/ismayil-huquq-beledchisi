import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { isSlug } from "@/lib/content";

/**
 * Study materials on individual laws and legal acts ("Mənbələr"). One MDX
 * file per act under content/sources:
 *
 *   content/sources/<slug>.mdx
 *
 * Frontmatter: title, kind (Konstitusiya | Məcəllə | Qanun | Konstitusiya
 * Qanunu | Fərman ...), number, adopted, inForce, summary, official (URL of
 * the authoritative text), order. The body is the study material.
 */

export const SOURCES_ROOT = path.join(process.cwd(), "content", "sources");

export type SourceMeta = {
  slug: string;
  title: string;
  kind: string;
  number: string | null;
  adopted: string | null;
  inForce: string | null;
  summary: string;
  official: string | null;
  order: number;
};

export type Source = SourceMeta & { body: string };

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toMeta(slug: string, data: Record<string, unknown>): SourceMeta {
  return {
    slug,
    title: str(data.title) ?? slug,
    kind: str(data.kind) ?? "Hüquqi akt",
    number: str(data.number),
    adopted: str(data.adopted),
    inForce: str(data.inForce),
    summary: str(data.summary) ?? "",
    official: str(data.official),
    order: typeof data.order === "number" && Number.isFinite(data.order) ? data.order : 0,
  };
}

export async function listSources(root: string = SOURCES_ROOT): Promise<SourceMeta[]> {
  let files: string[];
  try {
    files = await fs.readdir(root);
  } catch {
    return [];
  }
  const metas: SourceMeta[] = [];
  for (const file of files) {
    if (!file.endsWith(".mdx")) continue;
    const slug = file.slice(0, -".mdx".length);
    if (!isSlug(slug)) continue;
    const raw = await fs.readFile(path.join(root, file), "utf8");
    metas.push(toMeta(slug, matter(raw).data));
  }
  return metas.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "az"));
}

export async function getSource(slug: string, root: string = SOURCES_ROOT): Promise<Source | null> {
  if (!isSlug(slug)) return null;
  let raw: string;
  try {
    raw = await fs.readFile(path.join(root, `${slug}.mdx`), "utf8");
  } catch {
    return null;
  }
  const { data, content } = matter(raw);
  return { ...toMeta(slug, data), body: content };
}

/** Groups sources by kind, keeping the order of first appearance. */
export function groupByKind(sources: SourceMeta[]): { kind: string; items: SourceMeta[] }[] {
  const groups: { kind: string; items: SourceMeta[] }[] = [];
  for (const s of sources) {
    let g = groups.find((x) => x.kind === s.kind);
    if (!g) {
      g = { kind: s.kind, items: [] };
      groups.push(g);
    }
    g.items.push(s);
  }
  return groups;
}
