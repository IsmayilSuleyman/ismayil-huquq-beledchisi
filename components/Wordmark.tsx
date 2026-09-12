// İsmayıl Hüquq Bələdçisi logo: the four-pointed cross mark in gold and
// bronze (public/images/ihb-mark.svg, traced from the artwork) beside the name in
// Nunito Extra Bold capitals, matching the supplied logo artwork.

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

export function Wordmark({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  // Line 2 is the anchor size; line 1 is roughly 62% of it, as in the logo.
  const scale =
    size === "lg" ? "text-[1.7rem] sm:text-[2.05rem]" : size === "sm" ? "text-[0.95rem]" : "text-[1.2rem] sm:text-[1.35rem]";
  const markSize = size === "lg" ? 76 : size === "sm" ? 38 : 50;

  return (
    <span className={`inline-flex items-center gap-2.5 sm:gap-3 ${className}`}>
      <Mark size={markSize} />
      <span
        className={`flex flex-col font-brand font-extrabold uppercase leading-[0.98] tracking-[-0.01em] text-ink dark:text-brand-cream ${scale}`}
      >
        <span className="text-[0.62em]">İsmayıl</span>
        <span className="whitespace-nowrap">Hüquq Bələdçisi</span>
      </span>
    </span>
  );
}
