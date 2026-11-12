import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleFrame, { type WordingSource } from "@/components/versions/ArticleFrame";
import { ArticleBody } from "@/components/versions/LawText";
import { DateBar, VersionsProvider, type Stop } from "@/components/versions/VersionsProvider";
import { shortDate } from "@/lib/versions/act";
import { getVersionedAct, isAmended, listVersionedSlugs } from "@/lib/versions/load";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return (await listVersionedSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const act = await getVersionedAct((await params).slug);
  return { title: act ? `${act.short}: earlier wordings` : "Versions" };
}

export default async function VersionedActPage({ params }: { params: Params }) {
  const act = await getVersionedAct((await params).slug);
  if (!act) notFound();

  const sources: Record<string, WordingSource> = {
    [act.original.id]: { label: act.original.label },
    ...Object.fromEntries(act.amendments.map((a) => [a.id, { label: a.label, actTitle: a.act.title, eqanunId: a.act.eqanunId, decision: a.decision }])),
  };
  const stops: Stop[] = [
    { date: act.original.date, label: act.original.id },
    ...act.amendments.map((a) => ({ date: a.date, label: a.id })),
  ];
  const amended = Object.keys(act.articles).filter((n) => isAmended(act, n)).length;

  return (
    <div className="py-12 sm:py-16">
      <section className="text-center max-w-3xl mx-auto olg-rise">
        <p className="olg-eyebrow mb-5">
          <Link href="/versions" className="hover:text-foreground transition-colors">
            Versions
          </Link>{" "}
          · {act.short}
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.06] tracking-tight" lang="az">
          {act.short}: <span className="italic text-azure-soft">əvvəlki redaksiyalar</span>
        </h1>
        <p className="mt-5 text-foreground/65 text-base leading-relaxed">
          The full text in force, with the earlier wordings of the {amended} articles the{" "}
          {act.amendments.length} referendums changed. Hover an article with a blue line in the margin: the
          arrows step through its wordings, C shows what changed, ▶ plays the changes in order. The bar
          sets the whole text to the day a referendum took effect.
        </p>
      </section>

      <div className="mt-10 max-w-5xl mx-auto">
        <VersionsProvider>
          <DateBar stops={stops} />
          <div className="olg-law-page mt-5" lang="az">
            <div className="olg-law">
              <div className="olg-law-prose text-center">
                <h2 className="font-bold tracking-[0.04em] text-lg">{act.title.toLocaleUpperCase("az")}</h2>
                <div className="mt-4 space-y-1 text-[0.92rem] italic text-foreground/75">
                  {act.intro.map((line, i) => (
                    <p key={i} style={{ textIndent: 0, textAlign: "center" }}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
              <div className="olg-law-prose mt-8 space-y-1 olg-law-article" style={{ border: 0 }}>
                {act.preamble.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>

              {act.outline.map((entry, i) => {
                if (entry.kind !== "article") {
                  return (
                    <div key={i} className="olg-law-heading">
                      <span className={`olg-law-hlabel${entry.kind === "chapter" ? " spaced" : ""}`}>{entry.label}</span>
                      <span className="olg-law-htitle">{entry.title}</span>
                    </div>
                  );
                }
                const history = act.articles[entry.number];
                if (isAmended(act, entry.number)) return <ArticleFrame key={entry.number} history={history} sources={sources} />;
                const v = history.versions[0];
                return (
                  <section key={entry.number} id={`m-${entry.number}`} className="olg-law-article olg-law-static">
                    <ArticleBody number={entry.number} title={v.title} paragraphs={v.paragraphs} />
                  </section>
                );
              })}

              {act.closing.map((part, i) => (
                <div key={i} className="olg-law-prose">
                  <div className="olg-law-heading">
                    <span className="olg-law-htitle">{part.title.toLocaleUpperCase("az")}</span>
                  </div>
                  <div className="olg-law-article" style={{ border: 0 }}>
                    {part.paragraphs.map((p, k) => (
                      <p key={k}>{p}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </VersionsProvider>

        <section className="mt-8 olg-glass rounded-2xl p-6 text-sm text-foreground/70 leading-relaxed" lang="az">
          <p className="olg-eyebrow mb-3">Mənbələr</p>
          <ul className="list-disc pl-5 space-y-1">
            {act.sources.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
            <li>
              Redaksiyaların tarixi: referendumun nəticələrini təsdiq edən Mərkəzi Seçki Komissiyası qərarının tarixi (
              {act.amendments.map((a) => shortDate(a.date)).join(", ")}); e-qanun-un qeydləri dəyişikliyi bu qərarlara aid edir.
            </li>
          </ul>
          <p className="mt-3">
            Rəsmi mətn:{" "}
            <a className="underline underline-offset-2" href={`https://e-qanun.az/framework/${act.eqanunId}`} target="_blank" rel="noopener noreferrer">
              e-qanun.az/framework/{act.eqanunId}
            </a>
            . Bu səhifə tədris və iş məqsədi daşıyır; istinad etməzdən əvvəl rəsmi dərc olunmuş mətni yoxlayın.
          </p>
        </section>
      </div>
    </div>
  );
}
