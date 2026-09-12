"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function safeNextPath(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/courses";
}

export function GoogleSignInButton() {
  const supabase = createSupabaseBrowserClient();
  const isConfigured = supabase != null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const next = safeNextPath(
      new URLSearchParams(window.location.search).get("next"),
    );
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setLoading(false);
      setError("Google ilə giriş alınmadı. Bir az sonra yenidən cəhd edin.");
    }
    // On success the browser navigates away to Google.
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onClick}
        disabled={loading || !isConfigured}
        className="flex items-center justify-center gap-3 rounded-xl bg-brand-wood px-4 py-3.5 text-sm font-medium uppercase tracking-[0.16em] text-brand-cream shadow-glass-wood transition hover:-translate-y-0.5 hover:bg-brand-wood-deep disabled:opacity-60 disabled:hover:translate-y-0"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
          <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
            <path fill="#FBBC05" d="M10.4 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
        </span>
        {!isConfigured
          ? "Quraşdırma gözlənilir"
          : loading
            ? "Yönləndirilir..."
            : "Google ilə daxil olun"}
      </button>

      {!isConfigured ? (
        <p className="text-xs leading-5 text-ink/55 dark:text-white/60">
          Supabase ayarları hələ qurulmayıb. Mühit dəyişənləri əlavə
          edildikdən sonra giriş aktiv olacaq.
        </p>
      ) : null}

      {error ? (
        <p className="text-xs text-brand-red dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
