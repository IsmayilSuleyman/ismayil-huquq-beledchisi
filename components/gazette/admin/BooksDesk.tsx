"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatBytes } from "@/lib/gazette/format";
import { analyzePdf } from "@/lib/gazette/pdf-analyze";
import { GAZETTE_BUCKET, getBrowserSupabase, publicUrl } from "@/lib/gazette/supabase";
import type { Book } from "@/lib/gazette/types";

// The admin desk's Books tab: add a book (PDF, title, author, year,
// description, topics) and edit or delete the ones on the shelf. Files go to
// the gazette bucket under books/; the cover is the PDF's first page.

const MAX_PDF_BYTES = 50 * 1024 * 1024;

function parseTags(raw: string): string[] {
  return [...new Set(raw.split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 10);
}

function parseYear(raw: string): number | null | "bad" {
  if (!raw.trim()) return null;
  const y = Number(raw);
  return Number.isInteger(y) && y > 0 && y <= 3000 ? y : "bad";
}

type Fields = { title: string; author: string; year: string; description: string; tags: string };
const EMPTY: Fields = { title: "", author: "", year: "", description: "", tags: "" };

function FieldInputs({ fields, set }: { fields: Fields; set: (f: Fields) => void }) {
  return (
    <>
      <div className="sm:col-span-2">
        <label className="block text-xs text-silver mb-1.5">Title</label>
        <input
          value={fields.title}
          onChange={(e) => set({ ...fields, title: e.target.value })}
          maxLength={300}
          className="olg-field"
          required
        />
      </div>
      <div>
        <label className="block text-xs text-silver mb-1.5">Author (optional)</label>
        <input
          value={fields.author}
          onChange={(e) => set({ ...fields, author: e.target.value })}
          maxLength={200}
          className="olg-field"
        />
      </div>
      <div>
        <label className="block text-xs text-silver mb-1.5">Year (optional)</label>
        <input
          value={fields.year}
          onChange={(e) => set({ ...fields, year: e.target.value })}
          inputMode="numeric"
          maxLength={4}
          className="olg-field"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs text-silver mb-1.5">Description (optional)</label>
        <textarea
          value={fields.description}
          onChange={(e) => set({ ...fields, description: e.target.value })}
          rows={3}
          maxLength={4000}
          className="olg-field resize-y"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs text-silver mb-1.5">Topics (comma separated, optional)</label>
        <input
          value={fields.tags}
          onChange={(e) => set({ ...fields, tags: e.target.value })}
          placeholder="Civil law, Commentary"
          className="olg-field"
        />
      </div>
    </>
  );
}

/** The row to save, or an error message. */
function toRow(fields: Fields) {
  const year = parseYear(fields.year);
  if (!fields.title.trim()) return "Give the book a title.";
  if (year === "bad") return "The year should be a number like 2024.";
  return {
    title: fields.title.trim(),
    author: fields.author.trim() || null,
    year,
    description: fields.description.trim() || null,
    tags: parseTags(fields.tags),
  };
}

export default function BooksDesk() {
  const supabase = getBrowserSupabase();
  const fileInput = useRef<HTMLInputElement>(null);

  const [books, setBooks] = useState<Book[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<Blob | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const [editing, setEditing] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Fields>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  async function load() {
    const { data, error: err } = await supabase.from("books").select("*").order("created_at", { ascending: false });
    if (err) setListError(err.message);
    setBooks((data as Book[]) ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function acceptFile(f: File | undefined | null) {
    setError(null);
    setAdded(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      setError(`The PDF is ${formatBytes(f.size)} — the limit is 50 MB.`);
      return;
    }
    setFile(f);
    if (!fields.title) setFields((cur) => ({ ...cur, title: f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() }));
    setAnalyzing(true);
    setCover(null);
    setPageCount(null);
    try {
      const result = await analyzePdf(f);
      setPageCount(result.pageCount);
      setCover(result.cover);
    } catch {
      setError("Couldn’t read that PDF — it may be corrupted or password-protected.");
      setFile(null);
    } finally {
      setAnalyzing(false);
    }
  }

  async function addBook(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdded(null);
    if (!file) return setError("Choose the book’s PDF first.");
    const row = toRow(fields);
    if (typeof row === "string") return setError(row);

    const rand = crypto.randomUUID().slice(0, 8);
    const pdfPath = `books/book-${rand}.pdf`;
    const coverPath = cover ? `books/covers/book-${rand}.webp` : null;
    const storage = supabase.storage.from(GAZETTE_BUCKET);
    const uploaded: string[] = [];

    try {
      setStep("Uploading PDF…");
      const up1 = await storage.upload(pdfPath, file, { contentType: "application/pdf", cacheControl: "31536000" });
      if (up1.error) throw new Error(up1.error.message);
      uploaded.push(pdfPath);

      if (cover && coverPath) {
        setStep("Uploading cover…");
        const up2 = await storage.upload(coverPath, cover, { contentType: "image/webp", cacheControl: "31536000" });
        if (up2.error) throw new Error(up2.error.message);
        uploaded.push(coverPath);
      }

      setStep("Saving…");
      const { error: insertErr } = await supabase.from("books").insert({
        ...row,
        pdf_path: pdfPath,
        cover_path: coverPath,
        page_count: pageCount,
        file_size_bytes: file.size,
      });
      if (insertErr) throw new Error(insertErr.message);

      setAdded(row.title);
      setFile(null);
      setCover(null);
      setPageCount(null);
      setFields(EMPTY);
      if (fileInput.current) fileInput.current.value = "";
      await load();
    } catch (err) {
      if (uploaded.length) await storage.remove(uploaded).catch(() => {});
      setError(err instanceof Error ? err.message : "Saving failed. Please try again.");
    } finally {
      setStep(null);
    }
  }

  function startEdit(book: Book) {
    setEditing(book.id);
    setEditFields({
      title: book.title,
      author: book.author ?? "",
      year: book.year ? String(book.year) : "",
      description: book.description ?? "",
      tags: book.tags.join(", "),
    });
    setListError(null);
  }

  async function saveEdit(book: Book) {
    const row = toRow(editFields);
    if (typeof row === "string") return setListError(row);
    setBusy(book.id);
    const { error: err } = await supabase.from("books").update(row).eq("id", book.id);
    setBusy(null);
    if (err) return setListError(`Save failed: ${err.message}`);
    setEditing(null);
    await load();
  }

  async function removeBook(book: Book) {
    if (!confirm(`Delete “${book.title}”?\n\nThis removes the PDF permanently.`)) return;
    setBusy(book.id);
    setListError(null);
    const paths = [book.pdf_path, book.cover_path].filter(Boolean) as string[];
    const { error: rowErr } = await supabase.from("books").delete().eq("id", book.id);
    const { error: storageErr } = rowErr ? { error: null } : await supabase.storage.from(GAZETTE_BUCKET).remove(paths);
    setBusy(null);
    if (rowErr || storageErr) setListError(`Delete failed: ${(rowErr ?? storageErr)?.message}`);
    await load();
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-6 items-start">
      <form onSubmit={addBook} className="olg-glass rounded-2xl p-6 sm:p-7">
        <h2 className="font-serif text-xl mb-1.5">Add a book</h2>
        <p className="text-xs text-silver mb-5">PDF up to 50 MB; its first page becomes the cover.</p>

        <label
          className={`block rounded-xl border border-dashed px-5 py-6 text-center cursor-pointer transition-colors mb-5 ${
            file ? "border-azure/50 bg-omni/20" : "border-white/20 hover:border-azure/40 hover:bg-white/[0.03]"
          }`}
        >
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => void acceptFile(e.target.files?.[0])}
          />
          {file ? (
            <span className="text-sm">
              {file.name}
              <span className="block text-xs text-silver mt-1">
                {formatBytes(file.size)}
                {analyzing ? " · reading…" : pageCount ? ` · ${pageCount} pages` : ""}
              </span>
            </span>
          ) : (
            <span className="text-sm text-silver">Choose the PDF</span>
          )}
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <FieldInputs fields={fields} set={setFields} />
        </div>

        {error && <p className="text-sm text-red-300 mt-4">{error}</p>}
        {added && (
          <p className="text-sm text-emerald-300 mt-4">
            “{added}” is on the shelf.{" "}
            <Link href="/books" className="text-azure hover:underline">
              See the books
            </Link>
          </p>
        )}
        <button type="submit" disabled={Boolean(step) || analyzing} className="olg-btn olg-btn-primary mt-5">
          {step ?? "Add to the shelf"}
        </button>
      </form>

      <div className="space-y-3">
        {listError && <p className="text-sm text-red-300">{listError}</p>}
        {books === null ? (
          [0, 1, 2].map((i) => <div key={i} className="olg-skeleton h-20 rounded-xl" />)
        ) : books.length === 0 ? (
          <div className="olg-glass rounded-2xl p-10 text-center text-sm text-silver">No books yet.</div>
        ) : (
          books.map((book) => (
            <div key={book.id} className="olg-glass rounded-xl overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                <div className="w-12 h-16 shrink-0 rounded-md overflow-hidden bg-omni-ink border border-white/10">
                  {book.cover_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={publicUrl(book.cover_path)} alt="" className="w-full h-full object-cover object-top" loading="lazy" />
                  )}
                </div>
                <div className="min-w-0 grow">
                  <p className="text-sm font-medium truncate">{book.title}</p>
                  <p className="text-xs text-silver mt-0.5 truncate">
                    {[book.author, book.year, book.page_count ? `${book.page_count} pages` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/books/${book.id}`} className="olg-btn olg-btn-ghost !px-3 !py-2 text-xs">
                    View
                  </Link>
                  <button
                    className="olg-btn olg-btn-ghost !px-3 !py-2 text-xs"
                    onClick={() => (editing === book.id ? setEditing(null) : startEdit(book))}
                  >
                    {editing === book.id ? "Close" : "Edit"}
                  </button>
                  <button
                    className="olg-btn olg-btn-danger !px-3 !py-2 text-xs"
                    disabled={busy === book.id}
                    onClick={() => void removeBook(book)}
                  >
                    {busy === book.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
              {editing === book.id && (
                <div className="border-t olg-hairline p-4 sm:p-5 grid sm:grid-cols-2 gap-4 bg-black/20">
                  <FieldInputs fields={editFields} set={setEditFields} />
                  <div className="sm:col-span-2 flex justify-end gap-3">
                    <button className="olg-btn olg-btn-ghost !py-2" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                    <button
                      className="olg-btn olg-btn-primary !py-2"
                      disabled={busy === book.id}
                      onClick={() => void saveEdit(book)}
                    >
                      {busy === book.id ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
