"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import BookDownloadButton from "@/components/gazette/BookDownloadButton";
import type { BookWithUrls } from "@/lib/gazette/types";

function BookCard({ book, index }: { book: BookWithUrls; index: number }) {
  return (
    <article
      className="group relative olg-glass olg-glass-hover rounded-2xl overflow-hidden flex flex-col olg-rise"
      style={{ animationDelay: `${Math.min(index, 11) * 55}ms` }}
    >
      <Link href={`/books/${book.id}`} className="absolute inset-0 z-[5]" aria-label={`Read “${book.title}”`} />

      <div className="relative aspect-[3/4] overflow-hidden bg-omni-ink">
        {book.coverUrl ? (
          <Image
            src={book.coverUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 22vw"
            className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center bg-gradient-to-br from-omni/55 via-omni-ink to-omni-ink">
            <span className="font-serif text-2xl text-white/40 line-clamp-4">{book.title}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#05080f] via-[#05080f]/45 to-transparent" />
      </div>

      <div className="p-4 flex flex-col gap-2 grow">
        {(book.author || book.year) && (
          <p className="text-[0.7rem] tracking-[0.18em] uppercase text-silver truncate">
            {[book.author, book.year].filter(Boolean).join(" · ")}
          </p>
        )}
        <h3 className="font-serif text-[1.13rem] leading-snug text-foreground line-clamp-2">{book.title}</h3>
        {book.description && <p className="text-sm text-foreground/60 line-clamp-2">{book.description}</p>}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2 text-xs text-silver">
          <span>{book.page_count ? `${book.page_count} pages` : ""}</span>
          <span className="relative z-10">
            <BookDownloadButton book={book} variant="icon" />
          </span>
        </div>
      </div>
    </article>
  );
}

export default function BookShelf({ books }: { books: BookWithUrls[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  const tags = useMemo(() => [...new Set(books.flatMap((b) => b.tags))].sort((a, b) => a.localeCompare(b)), [books]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      if (tag && !b.tags.includes(tag)) return false;
      if (!q) return true;
      const haystack = [b.title, b.author ?? "", b.description ?? "", b.tags.join(" "), b.year ?? ""]
        .join(" ")
        .toLowerCase();
      return q.split(/\s+/).every((part) => haystack.includes(part));
    });
  }, [books, query, tag]);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-7">
        <div className="relative grow max-w-md">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-silver"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books — title, author, topic…"
            className="olg-field !pl-10"
            type="search"
            aria-label="Search books"
          />
        </div>

        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {[null, ...tags].map((t) => (
              <button
                key={t ?? "all"}
                onClick={() => setTag(t)}
                className={`olg-chip transition-colors cursor-pointer ${
                  tag === t ? "!bg-omni/70 !border-azure/50 !text-white" : "hover:bg-white/10"
                }`}
              >
                {t ?? "All topics"}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-silver md:ml-auto" aria-live="polite">
          {filtered.length} book{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="olg-glass rounded-2xl p-12 text-center text-foreground/65">
          <p className="font-serif text-xl mb-1.5">No books match that search.</p>
          <p className="text-sm text-silver">Try a different keyword or topic.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((book, idx) => (
            <BookCard key={book.id} book={book} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
