"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { analyzePdf } from "@/lib/pdf-analyze";
import { GAZETTE_BUCKET } from "@/lib/gazette";
import { formatBytes } from "@/lib/gazette-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

function parseTags(raw: string): string[] {
  return [...new Set(raw.split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 10);
}

export function PublishForm() {
  const supabase = createSupabaseBrowserClient();
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
    if (!supabase) return;
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
      setError("PDF faylı seçin.");
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      setError(`PDF ${formatBytes(f.size)} həcmindədir — limit 50 MB-dır.`);
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
      setError("PDF oxunmadı — fayl zədələnmiş və ya şifrəli ola bilər.");
      setFile(null);
    } finally {
      setAnalyzing(false);
    }
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) return setError("Verilənlər bazası hazır deyil.");
    const num = Number(issueNumber);
    if (!file) return setError("Əvvəlcə həftəlik PDF-i əlavə edin.");
    if (!title.trim()) return setError("Buraxılışa başlıq verin.");
    if (!Number.isInteger(num) || num <= 0) return setError("Buraxılış nömrəsi müsbət tam ədəd olmalıdır.");

    const rand = crypto.randomUUID().slice(0, 8);
    const pdfPath = `pdfs/issue-${num}-${rand}.pdf`;
    const coverPath = cover ? `covers/issue-${num}-${rand}.webp` : null;
    const storage = supabase.storage.from(GAZETTE_BUCKET);
    const uploaded: string[] = [];

    try {
      setStep("PDF yüklənir…");
      const up1 = await storage.upload(pdfPath, file, {
        contentType: "application/pdf",
        cacheControl: "31536000",
      });
      if (up1.error) throw new Error(up1.error.message);
      uploaded.push(pdfPath);

      if (cover && coverPath) {
        setStep("Üz qabığı yüklənir…");
        const up2 = await storage.upload(coverPath, cover, {
          contentType: "image/webp",
          cacheControl: "31536000",
        });
        if (up2.error) throw new Error(up2.error.message);
        uploaded.push(coverPath);
      }

      setStep("Buraxılış yadda saxlanılır…");
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
            ? `${num} nömrəli buraxılış artıq mövcuddur — başqa nömrə seçin.`
            : insertErr.message,
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
      setError(err instanceof Error ? err.message : "Nəşr alınmadı. Yenidən cəhd edin.");
    } finally {
      setStep(null);
    }
  }

  if (publishedNumber !== null) {
    return (
      <div className="glass rise p-10 text-center">
        <h2 className="mb-2 font-serif text-2xl font-semibold text-ink dark:text-brand-cream">
          {publishedNumber} nömrəli buraxılış nəşr olundu.
        </h2>
        <p className="mb-7 text-sm text-ink/55 dark:text-white/55">
          Artıq hər kəs üçün əlçatandır.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={`/gazette/${publishedNumber}`} className="btn btn-primary">
            Buraxılışa bax
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => setPublishedNumber(null)}>
            Yenisini nəşr et
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={publish} className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
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
          className={`relative w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed text-left transition-colors ${
            dragOver
              ? "border-brand-brass bg-brand-wood-mist"
              : "border-brand-wood-ring bg-white/40 hover:border-brand-brass dark:border-white/15 dark:bg-white/5"
          } ${coverPreview ? "aspect-[5/6]" : "aspect-[5/4]"}`}
        >
          {coverPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreview}
              alt="Üz qabığı (1-ci səhifə)"
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center p-6 text-center">
              <span>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden className="mx-auto mb-3 text-brand-brass">
                  <path d="M12 16V4m0 0 4.5 4.5M12 4 7.5 8.5M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="block text-sm font-medium text-ink/80 dark:text-white/80">
                  {analyzing ? "PDF oxunur…" : "Həftəlik PDF-i bura atın"}
                </span>
                <span className="mt-1.5 block text-xs text-ink/45 dark:text-white/45">
                  və ya seçmək üçün klikləyin · 50 MB-a qədər
                </span>
              </span>
            </span>
          )}
          {coverPreview && (
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8 text-xs text-white/85">
              Üz qabığı 1-ci səhifədən · faylı dəyişmək üçün klikləyin
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
          <p className="break-all text-xs leading-relaxed text-ink/45 dark:text-white/45">
            <span className="text-ink/85 dark:text-white/85">{file.name}</span>
            <br />
            {formatBytes(file.size)}
            {pageCount ? ` · ${pageCount} səhifə` : ""}
          </p>
        )}
      </div>

      {/* Metadata */}
      <div className="glass space-y-4 p-6 sm:p-7">
        <div>
          <label className="label" htmlFor="pub-title">
            Buraxılışın başlığı
          </label>
          <input
            id="pub-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder='məs. "Vergi Məcəlləsinə dəyişikliklər və yeni əmək qaydaları"'
            className="field"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pub-number">
              Buraxılış nömrəsi
            </label>
            <input
              id="pub-number"
              value={issueNumber}
              onChange={(e) => setIssueNumber(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="pub-date">
              Nəşr tarixi
            </label>
            <input
              id="pub-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="pub-summary">
            Xülasə <span className="opacity-60">(istəyə bağlı, kitabxanada görünür)</span>
          </label>
          <textarea
            id="pub-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Bu həftənin mövzuları haqqında iki-üç cümlə…"
            className="field resize-y"
          />
        </div>

        <div>
          <label className="label" htmlFor="pub-tags">
            Teqlər <span className="opacity-60">(vergüllə ayırın, istəyə bağlı)</span>
          </label>
          <input
            id="pub-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="vergi, əmək, məhkəmə təcrübəsi"
            className="field"
          />
        </div>

        {error && <p className="text-sm text-brand-red dark:text-red-300">{error}</p>}

        <div className="flex items-center gap-4 pt-1.5">
          <button
            type="submit"
            disabled={Boolean(step) || analyzing || !file}
            className="btn btn-primary !px-7"
          >
            {step ?? "Nəşr et"}
          </button>
          {step && <span className="animate-pulse text-xs text-ink/45 dark:text-white/45">{step}</span>}
        </div>
      </div>
    </form>
  );
}
