"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-32 grid place-items-center">
      <div className="olg-glass rounded-3xl p-12 text-center max-w-md">
        <p className="font-serif text-2xl mb-2">Something went wrong.</p>
        <p className="text-sm text-foreground/60 mb-7">
          The library couldn’t be reached. It is usually temporary.
        </p>
        <button onClick={reset} className="olg-btn olg-btn-primary">
          Try again
        </button>
      </div>
    </div>
  );
}
