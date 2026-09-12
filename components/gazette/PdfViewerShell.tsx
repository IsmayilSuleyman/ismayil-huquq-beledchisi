"use client";

import dynamic from "next/dynamic";

// pdf.js touches browser-only APIs, so the viewer must never render on the server.
const PdfViewer = dynamic(() => import("@/components/gazette/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="olg-glass-deep rounded-2xl h-[82vh] min-h-[480px] grid place-items-center">
      <div className="w-full max-w-xl px-10">
        <div className="olg-skeleton rounded-xl w-full aspect-[1/1.2]" />
        <p className="text-center text-xs text-silver mt-4 animate-pulse">
          Preparing the reading room…
        </p>
      </div>
    </div>
  ),
});

export default function PdfViewerShell(props: {
  fileUrl: string;
  issueId: string;
  issueNumber: number;
}) {
  return <PdfViewer {...props} />;
}
