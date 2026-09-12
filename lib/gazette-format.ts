// Fixed month table instead of Intl: not every browser ships Azerbaijani
// locale data, and the cards are client components — a table keeps server
// and client output identical (no hydration mismatch, no "M09").
const MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avqust",
  "sentyabr",
  "oktyabr",
  "noyabr",
  "dekabr",
];

function formatParts(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "5 sentyabr 2026" from an ISO date. */
export function formatDate(iso: string): string {
  return formatParts(new Date(`${iso.slice(0, 10)}T00:00:00`));
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/** Relative time in Azerbaijani: "3 gün əvvəl". */
export function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "indicə";
  const steps: [number, string][] = [
    [60, "dəqiqə"],
    [24, "saat"],
    [7, "gün"],
    [4.345, "həftə"],
    [12, "ay"],
    [Number.POSITIVE_INFINITY, "il"],
  ];
  let value = seconds / 60;
  let unit = "dəqiqə";
  for (const [step, name] of steps) {
    unit = name;
    if (value < step) break;
    value /= step;
  }
  return `${Math.floor(value)} ${unit} əvvəl`;
}

/** Monday of the week the issue was published, formatted. */
export function weekOf(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return formatParts(d);
}

/** Download filename for an issue. */
export function issueFilename(issueNumber: number): string {
  return `omni-law-gazette-issue-${String(issueNumber).padStart(3, "0")}.pdf`;
}
