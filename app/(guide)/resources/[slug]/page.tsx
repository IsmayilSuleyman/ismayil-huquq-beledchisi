import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { getSource } from "@/lib/sources";
import { profileFromUser } from "@/lib/user";
import { AppHeader } from "@/components/AppHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { LessonBody } from "@/components/LessonBody";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const source = await getSource(slug);
  return { title: source ? `${source.title} · Mənbələr` : "Mənbə" };
}

export default async function SourcePage({ params }: { params: Params }) {
  const { slug } = await params;
  const user = await requireUser(`/resources/${slug}`);
  const profile = profileFromUser(user);
  const source = await getSource(slug);
  if (!source) notFound();

  const facts = [
    source.number ? { label: "Nömrə", value: source.number } : null,
    source.adopted ? { label: "Qəbul edilib", value: source.adopted } : null,
    source.inForce ? { label: "Qüvvəyə minib", value: source.inForce } : null,
  ].filter((f): f is { label: string; value: string } => f !== null);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-16">
      <AppHeader name={profile.firstName} avatarUrl={profile.avatarUrl} />
      <Breadcrumbs items={[{ href: "/resources", label: "Mənbələr" }, { label: source.kind }]} />

      <article className="mx-auto max-w-3xl">
        <header className="mb-10">
          <span className="rounded-full border border-brand-brass/40 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-brass">
            {source.kind}
          </span>
          <h1 className="mt-4 text-[clamp(1.9rem,3.6vw,2.7rem)] font-semibold leading-tight tracking-[-0.02em] text-ink dark:text-brand-cream">
            {source.title}
          </h1>
          {source.summary ? (
            <p className="mt-4 text-base leading-7 text-ink/60 dark:text-white/60">{source.summary}</p>
          ) : null}
          <dl className="num mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ink/45 dark:text-white/45">{f.label}</dt>
                <dd className="mt-0.5 text-ink/80 dark:text-white/80">{f.value}</dd>
              </div>
            ))}
          </dl>
          {source.official ? (
            <a
              href={source.official}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-brand-wood/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-wood transition hover:-translate-y-0.5 hover:bg-brand-wood-mist dark:border-brand-brass/40 dark:text-brand-brass-soft dark:hover:bg-white/10"
            >
              Rəsmi mətn
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </a>
          ) : null}
        </header>

        <div className="glass-strong px-6 py-8 sm:px-10 sm:py-12">
          <LessonBody source={source.body} />
        </div>

        <p className="mt-6 text-xs leading-5 text-ink/45 dark:text-white/45">
          Bu material tədris məqsədi daşıyır. Tətbiq etməzdən əvvəl aktın
          qüvvədə olan redaksiyasını rəsmi mənbədə yoxlayın.
        </p>

        <div className="mt-8">
          <Link
            href="/resources"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45 transition hover:text-brand-wood dark:text-white/45 dark:hover:text-brand-brass-soft"
          >
            ← Bütün mənbələr
          </Link>
        </div>
      </article>
    </main>
  );
}
