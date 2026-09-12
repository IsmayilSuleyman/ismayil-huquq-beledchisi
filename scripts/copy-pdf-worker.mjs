// Copies the pdf.js worker that react-pdf depends on into public/ so the
// viewer can load it from a same-origin URL regardless of bundler.
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const workerSrc = join(
  dirname(require.resolve("pdfjs-dist/package.json")),
  "build",
  "pdf.worker.min.mjs"
);

await mkdir(join(root, "public"), { recursive: true });
await copyFile(workerSrc, join(root, "public", "pdf.worker.min.mjs"));
console.log("pdf.worker.min.mjs copied to public/");
