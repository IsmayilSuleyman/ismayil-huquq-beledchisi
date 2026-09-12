"use client";

import dynamic from "next/dynamic";

// pdf.js touches browser-only APIs, so the viewer must never render on the server.
const PdfViewer = dynamic(() => import("@/components/gazette/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="glass-strong grid h-[82vh] min-h-[480px] place-items-center">
      <div className="w-full max-w-xl px-10">
        <div className="skeleton aspect-[1/1.2] w-full rounded-xl" />
        <p className="mt-4 animate-pulse text-center text-xs text-ink/45 dark:text-white/45">
          Oxu otağı hazırlanır…
        </p>
      </div>
    </div>
  ),
});

export function PdfViewerShell(props: { fileUrl: string; issueId: string; issueNumber: number }) {
  return <PdfViewer {...props} />;
}
