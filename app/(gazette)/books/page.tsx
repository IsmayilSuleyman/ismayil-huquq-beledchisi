import type { Metadata } from "next";
import Link from "next/link";
import BookShelf from "@/components/gazette/BookShelf";
import { listBooks } from "@/lib/gazette/books";

export const revalidate = 60;

export const metadata: Metadata = { title: "Books" };

export default async function BooksPage() {
  const books = await listBooks();

  return (
    <div className="py-12 sm:py-16">
      <section className="text-center max-w-3xl mx-auto olg-rise">
        <p className="olg-eyebrow mb-5">Omni Law Firm · Internal Library</p>
        <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.04] tracking-tight">
          The <span className="italic text-azure-soft">Books</span>
        </h1>
        <p className="mt-5 text-foreground/65 text-base sm:text-lg leading-relaxed">
          Legal texts and reference books, to read here or download.
        </p>
      </section>

      <section className="mt-14">
        {books.length > 0 ? (
          <BookShelf books={books} />
        ) : (
          <div className="olg-glass rounded-3xl p-12 text-center max-w-xl mx-auto">
            <p className="font-serif text-2xl mb-2">The shelf is ready.</p>
            <p className="text-foreground/60 text-sm leading-relaxed">
              No books yet. Add the first one from the{" "}
              <Link href="/admin" className="text-azure hover:underline">
                admin desk
              </Link>{" "}
              (Books tab).
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
