import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="glass w-full max-w-sm p-10 text-center">
        <Wordmark size="sm" className="justify-center" />
        <h1 className="mt-8 text-2xl font-semibold text-ink dark:text-brand-cream">
          Səhifə tapılmadı
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink/55 dark:text-white/55">
          Axtardığınız dərs və ya kurs mövcud deyil.
        </p>
        <Link
          href="/courses"
          className="mt-8 inline-block rounded-xl bg-brand-wood px-5 py-3 text-sm font-medium uppercase tracking-[0.16em] text-brand-cream transition hover:-translate-y-0.5 hover:bg-brand-wood-deep"
        >
          Kurslara qayıdın
        </Link>
      </div>
    </main>
  );
}
