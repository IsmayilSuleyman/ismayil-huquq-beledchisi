import { diffParagraphs, diffWords, type DiffPiece } from "@/lib/versions/diff";

/** "98-1" as the print sets it: 98 with a raised 1. */
export function ArticleNumber({ number }: { number: string }) {
  const [main, sup] = number.split("-");
  return (
    <>
      {main}
      {sup ? <sup>{sup}</sup> : null}
    </>
  );
}

function Pieces({ pieces }: { pieces: DiffPiece[] }) {
  return (
    <>
      {pieces.map((p, i) =>
        p.kind === "del" ? (
          <del key={i} className="olg-del">
            {p.text}
          </del>
        ) : p.kind === "ins" ? (
          <ins key={i} className="olg-ins">
            {p.text}
          </ins>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** An article's heading and paragraphs, plain. */
export function ArticleBody({ number, title, paragraphs }: { number: string; title: string; paragraphs: string[] }) {
  return (
    <>
      <h3>
        <span className="olg-law-num">
          Maddə <ArticleNumber number={number} />.
        </span>
        <span className="olg-law-name">{title}</span>
      </h3>
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </>
  );
}

/** An article as track changes from one wording to the next: removed words struck in red, added in green. */
export function ArticleDiff({
  number,
  before,
  after,
}: {
  number: string;
  before: { title: string; paragraphs: string[] };
  after: { title: string; paragraphs: string[] };
}) {
  const title = diffWords(before.title, after.title);
  const lines = diffParagraphs(diffWords(before.paragraphs.join("\n"), after.paragraphs.join("\n")));
  return (
    <>
      <h3>
        <span className="olg-law-num">
          Maddə <ArticleNumber number={number} />.
        </span>
        <span className="olg-law-name">
          <Pieces pieces={title} />
        </span>
      </h3>
      {lines.map((line, i) => (
        <p key={i}>
          <Pieces pieces={line} />
        </p>
      ))}
    </>
  );
}
