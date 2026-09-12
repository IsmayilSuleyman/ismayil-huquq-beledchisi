import { ReactNode } from "react";

export function StatTile({
  label,
  value,
  children,
  sub,
  tone = "neutral",
  className,
}: {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "positive" | "negative";
  className?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-status-done dark:text-brand-brass-soft"
      : tone === "negative"
        ? "text-brand-red dark:text-red-400"
        : "text-ink dark:text-white/90";

  return (
    <div className={className ?? "glass flex flex-col gap-2 p-6"}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-brand-brass">
        {label}
      </div>
      {children ?? (
        <div className={`num text-4xl font-bold md:text-5xl ${toneClass}`}>
          {value}
        </div>
      )}
      {sub && (
        <div className="max-w-xs text-xs leading-snug text-ink/45 dark:text-white/50">
          {sub}
        </div>
      )}
    </div>
  );
}
