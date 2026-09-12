export function ProgressBar({
  percent,
  className = "",
}: {
  percent: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-ink/10 dark:bg-white/10 ${className}`}
    >
      <div
        className="h-full rounded-full bg-brand-brass transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
