import type { Metadata } from "next";
import Link from "next/link";
import { getVersionedAct, isAmended, listVersionedSlugs } from "@/lib/versions/load";

export const metadata: Metadata = { title: "Versions" };

export default async function VersionsIndex() {
  const acts = (await Promise.all((await listVersionedSlugs()).map(getVersionedAct))).filter((a) => a !== null);

  return (
    <div className="py-12 sm:py-16">
      <section className="text-center max-w-3xl mx-auto olg-rise">
        <p className="olg-eyebrow mb-5">Omni Law Firm · Internal Library</p>
        <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.04] tracking-tight">
          Earlier <span className="italic text-azure-soft">Wordings</span>
        </h1>
        <p className="mt-5 text-foreground/65 text-base sm:text-lg leading-relaxed">
          The full text of an act with every amended article&rsquo;s earlier wordings, step by step, as
          track changes. Built from e-qanun&rsquo;s consolidated text and its notes; check the official
          publication before citing.
        </p>
      </section>

      <section className="mt-14 grid gap-5 sm:grid-cols-2 max-w-4xl mx-auto">
        {acts.map((act) => {
          const amended = Object.keys(act.articles).filter((n) => isAmended(act, n)).length;
          return (
            <Link key={act.slug} href={`/versions/${act.slug}`} className="olg-glass olg-glass-hover rounded-3xl p-7 block" lang="az">
              <p className="olg-eyebrow mb-3">{act.short}</p>
              <p className="font-serif text-2xl leading-snug">{act.title}</p>
              <p className="mt-4 text-sm text-foreground/60">
                {Object.keys(act.articles).length} maddə · {amended} maddənin əvvəlki redaksiyası ·{" "}
                {act.amendments.map((a) => a.label.slice(0, 4)).join(", ")}
              </p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
