// İsmayıl Hüquq Bələdçisi logo: the four-pointed cross mark in gold and
// bronze (public/images/ihb-mark.svg, traced from the artwork) beside the
// name. The name is shipped as vector outlines of Nunito Extra Bold
// (public/images/ihb-wordmark-*.svg, generated from the font file), so it
// renders identically everywhere and never falls back to a system face.
// Proportions follow the artwork: two flush-left lines, the first slightly
// smaller, tight leading, and a mark about as tall as the two-line block.

const WORDMARK_RATIO = 4.6393; // width / height of the text block

export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/ihb-mark.svg"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

const SIZES = {
  xs: { text: 24, mark: 24, gap: 7 },
  sm: { text: 30, mark: 30, gap: 9 },
  md: { text: 46, mark: 44, gap: 13 },
  lg: { text: 72, mark: 70, gap: 20 },
} as const;

export function Wordmark({
  size = "md",
  className = "",
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  const width = Math.round(s.text * WORDMARK_RATIO);
  const img = (src: string, cls: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      width={width}
      height={s.text}
      className={`select-none ${cls}`}
      style={{ width, height: s.text }}
    />
  );
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: s.gap }}>
      <Mark size={s.mark} />
      <span className="sr-only">İsmayıl Hüquq Bələdçisi</span>
      {img("/images/ihb-wordmark-ink.svg", "dark:hidden")}
      {img("/images/ihb-wordmark-cream.svg", "hidden dark:block")}
    </span>
  );
}
