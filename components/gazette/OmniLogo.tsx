// Omni Law Firm mark, recreated in CSS from the official logo: a navy block
// with a light "omni" wordmark and a letter-spaced "LAW FIRM" caption. Kept
// as markup so it stays crisp at any size and works on cream and dark.

export function OmniMark({
  size = 28,
  caption = false,
  className = "",
}: {
  size?: number;
  caption?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex select-none flex-col items-center leading-none ${className}`}
      style={{ fontSize: size * 0.48 }}
    >
      <span
        className="rounded-[3px] bg-[#1d4287] px-[0.5em] pb-[0.3em] pt-[0.08em] font-light lowercase tracking-[0.015em] text-white shadow-[0_4px_14px_-6px_rgba(29,66,135,0.9),inset_0_1px_0_rgba(255,255,255,0.18)]"
        style={{ fontSize: "1.75em", lineHeight: 1.05 }}
      >
        omni
      </span>
      {caption ? (
        <span className="mt-[0.45em] whitespace-nowrap text-center text-[0.58em] font-light uppercase tracking-[0.55em] text-ink/55 [text-indent:0.2em] dark:text-white/55">
          Law Firm
        </span>
      ) : null}
    </span>
  );
}

export function GazetteWordmark({
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
  const markSize = size === "lg" ? 46 : size === "sm" ? 26 : 32;

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <OmniMark size={markSize} />
      <span className="flex flex-col leading-none">
        <span className="text-[9px] font-semibold uppercase tracking-[0.26em] text-brand-brass">
          Omni Law Firm
        </span>
        <span
          className={`mt-1 font-semibold tracking-[-0.01em] text-ink dark:text-brand-cream ${nameClass}`}
        >
          Law Gazette
        </span>
      </span>
    </span>
  );
}
