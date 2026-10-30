import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BookDownloadButton from "@/components/gazette/BookDownloadButton";
import PdfViewerShell from "@/components/gazette/PdfViewerShell";
import { getBook } from "@/lib/gazette/books";
import { formatBytes } from "@/lib/gazette/format";

export const revalidate = 60;

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const book = await getBook((await params).id);
  if (!book) return { title: "Book not found" };
  return { title: book.title, description: book.description ?? undefined };
}

export default async function BookPage({ params }: { params: Promise<Params> }) {
  const book = await getBook((await params).id);
  if (!book) notFound();

  return (
    <div className="py-8 sm:py-10">
      <nav className="mb-6 text-sm">
        <Link href="/books" className="inline-flex items-center gap-1.5 text-silver hover:text-white transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to the books
        </Link>
      </nav>

      <header className="olg-glass rounded-2xl p-6 sm:p-8 mb-6 olg-rise">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <div className="max-w-3xl">
            {(book.author || book.year) && (
              <p className="text-xs tracking-[0.18em] uppercase text-silver">
                {[book.author, book.year].filter(Boolean).join(" · ")}
              </p>
            )}
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl leading-tight">{book.title}</h1>
            {book.description && <p className="mt-3 text-foreground/65 leading-relaxed">{book.description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-silver">
              {book.page_count && <span>{book.page_count} pages</span>}
              {book.file_size_bytes && <span>· {formatBytes(book.file_size_bytes)}</span>}
              {book.tags.map((t) => (
                <span key={t} className="olg-chip !py-0.5">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <BookDownloadButton book={book} className="shrink-0" />
        </div>
      </header>

      <div className="olg-rise" style={{ animationDelay: "90ms" }}>
        <PdfViewerShell
          fileUrl={book.pdfUrl}
          download={<BookDownloadButton book={book} variant="icon" className="!w-[2.125rem] !h-[2.125rem]" />}
        />
        <p className="hidden sm:block text-[0.7rem] text-silver text-center mt-3">
          Tip: click the viewer, then use ← → to flip pages and +/− to zoom.
        </p>
        <p className="sm:hidden text-[0.7rem] text-silver text-center mt-3">Tip: pinch with two fingers to zoom.</p>
      </div>
    </div>
  );
}
