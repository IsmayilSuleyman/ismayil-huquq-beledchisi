const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(`${iso.slice(0, 10)}T00:00:00`));
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const steps: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let value = seconds;
  let unit = "second";
  for (const [step, name] of steps) {
    unit = name;
    if (value < step) break;
    value /= step;
  }
  const n = Math.floor(value);
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

/** "Week of" label for a published date (Monday of that week). */
export function weekOf(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return dateFmt.format(d);
}
