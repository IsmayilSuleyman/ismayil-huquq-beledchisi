import Link from "next/link";
import type { Metadata } from "next";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Wordmark } from "@/components/Wordmark";

export const metadata: Metadata = { title: "Daxil olun" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="glass p-10">
          <div className="mb-10 flex w-full flex-col items-center text-center">
            <Wordmark size="md" />
            <p className="mt-5 text-sm leading-6 text-ink/55 dark:text-white/55">
              Google hesabınızla daxil olun. Dərslər üzrə irəliləyişiniz
              hesabınızda saxlanılır.
            </p>
          </div>

          {error === "oauth" ? (
            <p className="mb-5 rounded-xl border border-brand-red/20 bg-brand-red/5 px-4 py-3 text-xs leading-5 text-brand-red dark:text-red-300">
              Giriş tamamlanmadı. Zəhmət olmasa yenidən cəhd edin.
            </p>
          ) : null}

          <div className="flex flex-col gap-4">
            <GoogleSignInButton />
            <Link
              href="/"
              className="rounded-xl border border-brand-wood/20 bg-white/70 px-4 py-3 text-center text-sm font-medium uppercase tracking-[0.18em] text-ink/70 transition hover:-translate-y-0.5 hover:border-brand-wood hover:text-brand-wood dark:bg-white/10 dark:text-white/75 dark:hover:text-brand-brass-soft"
            >
              Ana səhifə
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] leading-5 text-ink/45 dark:text-white/45">
          Daxil olmaqla platformanın istifadə şərtlərini qəbul etmiş olursunuz.
        </p>
      </div>
    </main>
  );
}
