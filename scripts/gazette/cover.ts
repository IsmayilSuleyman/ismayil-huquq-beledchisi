import { createCanvas } from "@napi-rs/canvas";

/**
 * Server-side twin of pdf-analyze.ts for the automated publisher: counts
 * the pages and renders page 1 into the WebP cover the library grid shows,
 * at the same width (860 px) and quality as covers made in the browser.
 * pdf.js runs in Node through its legacy build; @napi-rs/canvas stands in
 * for the browser canvas and does the WebP encoding.
 */
export async function analyzePdfBuffer(pdf: Uint8Array): Promise<{ pageCount: number; cover: Buffer }> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdf.js takes ownership of (and detaches) the buffer it is given.
  const doc = await getDocument({ data: new Uint8Array(pdf), isEvalSupported: false, verbosity: 0 }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, 860 / base.width);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    return { pageCount: doc.numPages, cover: await canvas.encode("webp", 86) };
  } finally {
    await doc.destroy();
  }
}
