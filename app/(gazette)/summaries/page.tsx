import type { Metadata } from "next";
import SummaryShelf from "@/components/gazette/SummaryShelf";
import { listSummaries } from "@/lib/gazette/summaries";

export const revalidate = 60;

export const metadata: Metadata = { title: "Summaries" };

export default async function SummariesPage() {
  const summaries = await listSummaries();

  return (
    <div className="py-12 sm:py-16">
      <section className="text-center max-w-3xl mx-auto olg-rise">
        <p className="olg-eyebrow mb-5">Omni Law Firm · Internal Library</p>
        <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.04] tracking-tight">
          Court <span className="italic text-azure-soft">Summaries</span>
        </h1>
        <p className="mt-5 text-foreground/65 text-base sm:text-lg leading-relaxed">
          The Constitutional Court&rsquo;s positions, decision by decision: the passages a colleague would
          cite, quoted verbatim, with a Word file to download. Summarised automatically each morning in
          the firm&rsquo;s usual way; check the original before citing.
        </p>
      </section>

      <section className="mt-14">
        {summaries.length > 0 ? (
          <SummaryShelf summaries={summaries} />
        ) : (
          <div className="olg-glass rounded-3xl p-12 text-center max-w-xl mx-auto">
            <p className="font-serif text-2xl mb-2">The shelf is ready.</p>
            <p className="text-foreground/60 text-sm leading-relaxed">
              No summaries yet. The morning routine adds one for each new decision of the Plenum that
              matters to the firm&rsquo;s clients.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
