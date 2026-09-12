"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { analyzePdf } from "@/lib/gazette/pdf-analyze";
import { GAZETTE_BUCKET, getBrowserSupabase } from "@/lib/gazette/supabase";
import { formatBytes } from "@/lib/gazette/format";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

function parseTags(raw: string): string[] {
  return [...new Set(raw.split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 10);
}

export default function PublishForm() {
  const supabase = getBrowserSupabase();
  const fileInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [title, setTitle] = useState("");
  const [issueNumber, setIssueNumber] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");

  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishedNumber, setPublishedNumber] = useState<number | null>(null);

  useEffect(() => {
    void supabase
      .from("issues")
      .select("issue_number")
      .order("issue_number", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setIssueNumber(String(((data?.issue_number as number | undefined) ?? 0) + 1));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cover) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  async function acceptFile(f: File | undefined | null) {
    setError(null);
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

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const num = Number(issueNumber);
    if (!file) return setError("Add the weekly PDF first.");
    if (!title.trim()) return setError("Give the issue a title.");
    if (!Number.isInteger(num) || num <= 0) return setError("Issue number must be a positive whole number.");

    const rand = crypto.randomUUID().slice(0, 8);
    const pdfPath = `pdfs/issue-${num}-${rand}.pdf`;
    const coverPath = cover ? `covers/issue-${num}-${rand}.webp` : null;
    const storage = supabase.storage.from(GAZETTE_BUCKET);
    const uploaded: string[] = [];

    try {
      setStep("Uploading PDF…");
      const up1 = await storage.upload(pdfPath, file, {
        contentType: "application/pdf",
        cacheControl: "31536000",
      });
      if (up1.error) throw new Error(up1.error.message);
      uploaded.push(pdfPath);

      if (cover && coverPath) {
        setStep("Uploading cover…");
        const up2 = await storage.upload(coverPath, cover, {
          contentType: "image/webp",
          cacheControl: "31536000",
        });
        if (up2.error) throw new Error(up2.error.message);
        uploaded.push(coverPath);
      }

      setStep("Saving issue…");
      const { error: insertErr } = await supabase.from("issues").insert({
        issue_number: num,
        title: title.trim(),
        summary: summary.trim() || null,
        published_at: date,
        tags: parseTags(tags),
        pdf_path: pdfPath,
        cover_path: coverPath,
        page_count: pageCount,
        file_size_bytes: file.size,
      });
      if (insertErr) {
        throw new Error(
          insertErr.code === "23505"
            ? `Issue number ${num} already exists — pick another number.`
            : insertErr.message
        );
      }

      setPublishedNumber(num);
      setFile(null);
      setCover(null);
      setPageCount(null);
      setTitle("");
      setSummary("");
      setTags("");
      setIssueNumber(String(num + 1));
      if (fileInput.current) fileInput.current.value = "";
    } catch (err) {
      // Roll back any files we managed to upload before the failure.
      if (uploaded.length) await storage.remove(uploaded).catch(() => {});
      setError(err instanceof Error ? err.message : "Publish failed. Please try again.");
    } finally {
      setStep(null);
    }
  }

  if (publishedNumber !== null) {
    return (
      <div className="olg-glass rounded-2xl p-10 text-center olg-rise">
        <p className="text-4xl mb-3">🎉</p>
        <h2 className="font-serif text-2xl mb-2">Issue No. {publishedNumber} is published.</h2>
        <p className="text-sm text-silver mb-7">
          It is live for everyone now (the library page refreshes within a minute).
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href={`/gazette/issues/${publishedNumber}`} className="olg-btn olg-btn-primary">
            View the issue
          </Link>
          <button className="olg-btn olg-btn-ghost" onClick={() => setPublishedNumber(null)}>
            Publish another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={publish} className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
      {/* PDF dropzone + cover preview */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void acceptFile(e.dataTransfer.files?.[0]);
          }}
          className={`relative w-full rounded-2xl border-2 border-dashed transition-colors overflow-hidden text-left cursor-pointer ${
            dragOver ? "border-azure bg-omni/20" : "border-white/15 hover:border-azure/50 bg-white/[0.03]"
          } ${coverPreview ? "aspect-[5/6]" : "aspect-[5/4]"}`}
        >
          {coverPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPreview} alt="Cover preview (page 1)" className="absolute inset-0 w-full h-full object-cover object-top" />
          ) : (
            <span className="absolute inset-0 grid place-items-center p-6 text-center">
              <span>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden className="mx-auto mb-3 text-azure">
                  <path d="M12 16V4m0 0 4.5 4.5M12 4 7.5 8.5M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="block text-sm text-foreground/80 font-medium">
                  {analyzing ? "Reading the PDF…" : "Drop the weekly PDF here"}
                </span>
                <span className="block text-xs text-silver mt-1.5">or click to browse · up to 50 MB</span>
              </span>
            </span>
          )}
          {coverPreview && (
            <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8 text-xs text-white/85">
              Cover from page 1 · click to replace the file
            </span>
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => void acceptFile(e.target.files?.[0])}
        />
        {file && (
          <p className="text-xs text-silver leading-relaxed break-all">
            <span className="text-foreground/85">{file.name}</span>
            <br />
            {formatBytes(file.size)}
            {pageCount ? ` · ${pageCount} pages` : ""}
          </p>
        )}
      </div>

      {/* Metadata */}
      <div className="olg-glass rounded-2xl p-6 sm:p-7 space-y-4">
        <div>
          <label className="block text-xs text-silver mb-1.5" htmlFor="pub-title">
            Issue title
          </label>
          <input
            id="pub-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder='e.g. "Tax code amendments & new labour regulations"'
            className="olg-field"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-silver mb-1.5" htmlFor="pub-number">
              Issue number
            </label>
            <input
              id="pub-number"
              value={issueNumber}
              onChange={(e) => setIssueNumber(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className="olg-field"
            />
          </div>
          <div>
            <label className="block text-xs text-silver mb-1.5" htmlFor="pub-date">
              Publication date
            </label>
            <input
              id="pub-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="olg-field [color-scheme:dark]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-silver mb-1.5" htmlFor="pub-summary">
            Summary <span className="opacity-60">(optional, shows in the library)</span>
          </label>
          <textarea
            id="pub-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Two or three sentences on what this week covers…"
            className="olg-field resize-y"
          />
        </div>

        <div>
          <label className="block text-xs text-silver mb-1.5" htmlFor="pub-tags">
            Tags <span className="opacity-60">(comma separated, optional)</span>
          </label>
          <input
            id="pub-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="tax, labour, court practice"
            className="olg-field"
          />
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="pt-1.5 flex items-center gap-4">
          <button type="submit" disabled={Boolean(step) || analyzing || !file} className="olg-btn olg-btn-primary !px-7">
            {step ?? "Publish issue"}
          </button>
          {step && <span className="text-xs text-silver animate-pulse">{step}</span>}
        </div>
      </div>
    </form>
  );
}
