// Shimmer placeholder primitives for route loading states (loading.tsx).
// Bone = one pulsing block; compose them to sketch the page's layout so
// the swap to real content doesn't shift things around.

export function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg bg-ink/10 dark:bg-white/10 ${className}`}
    />
  );
}

// Sticky header strip matching AppHeader dimensions.
export function HeaderBones() {
  return (
    <div className="sticky top-0 z-40 mb-12 border-b border-brand-wood/15 bg-white/55 px-6 backdrop-blur-md dark:bg-white/5">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 py-5">
        <Bone className="h-8 w-40 sm:w-52" />
        <div className="flex items-center gap-4">
          <Bone className="hidden h-3 w-16 sm:block" />
          <Bone className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}

// Page title block: small eyebrow label, big heading, meta line.
export function TitleBones() {
  return (
    <div>
      <Bone className="h-3 w-40" />
      <Bone className="mt-5 h-10 w-72 max-w-full sm:h-12 sm:w-96" />
      <Bone className="mt-4 h-3 w-80 max-w-full" />
    </div>
  );
}

// Glass card with a label row and `rows` content lines.
export function CardBones({
  rows = 3,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`glass p-6 ${className}`}>
      <Bone className="h-3 w-32" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <Bone className="h-3 w-40 max-w-[60%]" />
            <Bone className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
