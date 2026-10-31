/**
 * The areas of law a Constitutional Court summary is tagged with, for the
 * shelf's filters. A fixed list, so the chips stay few and consistent; the
 * database checks the same list (migration court_summaries_authors_tags).
 */

export const SUMMARY_TAGS = [
  "civil",
  "commercial",
  "corporate",
  "property",
  "labour",
  "tax",
  "banking",
  "administrative",
  "criminal",
  "procedure",
  "enforcement",
  "constitutional",
] as const;

export type SummaryTag = (typeof SUMMARY_TAGS)[number];

export const TAG_LABEL: Record<SummaryTag, string> = {
  civil: "Civil",
  commercial: "Commercial",
  corporate: "Corporate",
  property: "Property",
  labour: "Labour",
  tax: "Tax",
  banking: "Banking",
  administrative: "Administrative",
  criminal: "Criminal",
  procedure: "Procedure",
  enforcement: "Enforcement",
  constitutional: "Constitutional",
};

export function isSummaryTag(value: unknown): value is SummaryTag {
  return typeof value === "string" && (SUMMARY_TAGS as readonly string[]).includes(value);
}
