// İsmayıl Hüquq Bələdçisi logo: the four-pointed cross mark in gold and
// bronze (public/images/ihb-mark.svg, traced from the artwork) beside the
// name in Nunito Extra Bold capitals. Proportions follow the artwork: two
// flush-left lines of almost equal size, tight leading, and a mark about as
// tall as the two-line block, with a gap of roughly half a line.

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
  sm: { text: "text-[0.95rem]", mark: 30, gap: 9 },
  md: { text: "text-[1.3rem] sm:text-[1.45rem]", mark: 44, gap: 13 },
  lg: { text: "text-[1.95rem] sm:text-[2.3rem]", mark: 70, gap: 20 },
} as const;

export function Wordmark({
  size = "md",
  className = "",
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: s.gap }}>
      <Mark size={s.mark} />
      <span
        className={`flex flex-col text-left font-brand font-extrabold uppercase leading-[1.08] tracking-[-0.005em] text-ink dark:text-brand-cream ${s.text}`}
      >
        <span className="text-[0.9em] leading-[1.08]">İsmayıl</span>
        <span className="whitespace-nowrap">Hüquq Bələdçisi</span>
      </span>
    </span>
  );
}
