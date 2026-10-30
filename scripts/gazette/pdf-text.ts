/** All text in a PDF, page by page, with pdf.js's line breaks kept. */
export async function pdfText(pdf: Uint8Array): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdf.js takes ownership of (and detaches) the buffer it is given.
  const doc = await getDocument({ data: new Uint8Array(pdf), isEvalSupported: false, verbosity: 0 }).promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      let page = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        page += item.str + (item.hasEOL ? "\n" : "");
      }
      pages.push(page.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim());
    }
    return pages.join("\n\n");
  } finally {
    await doc.destroy();
  }
}
