// Text wordmark used until a drawn logo exists. The mark is a pair of
// scales in brass; the name sets "İsmayıl" as a small eyebrow over the
// serif "Hüquq Bələdçisi".

export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={className}
    >
      <rect x="1" y="1" width="30" height="30" rx="8" className="fill-brand-wood dark:fill-brand-brass" />
      <g stroke="#f6efe3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 7v18" />
        <path d="M11 25h10" />
        <path d="M8 11h16" />
        <path d="M8 11l-3.5 7h7z" />
        <path d="M24 11l-3.5 7h7z" />
      </g>
    </svg>
  );
}

export function Wordmark({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const nameClass =
    size === "lg"
      ? "text-[1.9rem] sm:text-[2.3rem]"
      : size === "sm"
        ? "text-[1.05rem]"
        : "text-[1.25rem] sm:text-[1.4rem]";
  const markSize = size === "lg" ? 44 : size === "sm" ? 24 : 30;

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <Mark size={markSize} />
      <span className="flex flex-col leading-none">
        <span className="text-[9px] font-semibold uppercase tracking-[0.26em] text-brand-brass">
          İsmayıl
        </span>
        <span
          className={`mt-1 font-serif font-semibold tracking-[-0.01em] text-ink dark:text-brand-cream ${nameClass}`}
        >
          Hüquq Bələdçisi
        </span>
      </span>
    </span>
  );
}
