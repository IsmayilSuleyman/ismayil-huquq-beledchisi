/**
 * Client-side PDF inspection for the publish flow: counts pages and renders
 * page 1 into a WebP cover image so the library grid never has to load PDFs.
 */
export async function analyzePdf(
  file: File
): Promise<{ pageCount: number; cover: Blob | null }> {
  const { pdfjs } = await import("react-pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, 860 / base.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) return { pageCount: doc.numPages, cover: null };

    await page.render({ canvasContext, viewport, canvas }).promise;
    const cover = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.86)
    );
    return { pageCount: doc.numPages, cover };
  } finally {
    void doc.destroy();
  }
}
