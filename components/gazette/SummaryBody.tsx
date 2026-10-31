import { parseMarks } from "@/lib/gazette/marks";
import type { SummaryBlock } from "@/lib/gazette/types";

// The Court's passages as the summary quotes them: Elgun's underline, bold
// and italic kept (lib/gazette/marks.ts), his own block headings underlined,
// the decision's sub-lists as indented italic items. Azerbaijani throughout.

function Marked({ text }: { text: string }) {
  return (
    <>
      {parseMarks(text).map((s, i) => {
        let node: React.ReactNode = s.text;
        if (s.italic) node = <em>{node}</em>;
        if (s.underline) node = <u className="decoration-azure-soft/70 underline-offset-[3px]">{node}</u>;
        if (s.bold) node = <strong className="font-semibold text-foreground">{node}</strong>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

export default function SummaryBody({ blocks, className = "" }: { blocks: SummaryBlock[]; className?: string }) {
  return (
    <div className={`text-[1.02rem] leading-[1.75] text-foreground/85 ${className}`} lang="az">
      {blocks.map((block, b) => (
        <section key={b} className={b > 0 ? "mt-8" : ""}>
          {block.heading && (
            <h3 className="mb-3 font-semibold text-foreground underline decoration-azure-soft/70 underline-offset-[3px]">
              {block.heading}
            </h3>
          )}
          <ul className="space-y-4">
            {block.bullets.map((bullet, i) => (
              <li key={i} className="relative pl-6">
                <span aria-hidden className="absolute left-0 top-[0.72em] h-2 w-2 rounded-full bg-azure/80" />
                <p className="text-justify hyphens-auto">
                  <Marked text={bullet.text} />
                </p>
                {bullet.sub && (
                  <ul className="mt-2.5 space-y-2 pl-5">
                    {bullet.sub.map((item, j) => (
                      <li key={j} className="relative pl-5 italic text-foreground/80">
                        <span aria-hidden className="absolute left-0 top-[0.78em] h-1.5 w-1.5 rounded-full border border-azure/70" />
                        <Marked text={item} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
