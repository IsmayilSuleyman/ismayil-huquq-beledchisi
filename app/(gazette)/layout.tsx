import type { Metadata } from "next";
import SiteHeader from "@/components/gazette/SiteHeader";
import "./gazette.css";

// Omni Law Gazette keeps its own design inside the guide: this layout wraps
// the /gazette section in the gazette's dark shell (see gazette.css, where
// every class is prefixed olg- so nothing collides with the guide).
export const metadata: Metadata = {
  title: {
    default: "Omni Law Gazette",
    template: "%s · Omni Law Gazette",
  },
  description:
    "Weekly legislature digest of Omni Law Firm — the library of weekly issues.",
};

export default function GazetteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="olg-root relative isolate flex min-h-screen flex-col">
      <div className="olg-aurora" aria-hidden />
      <SiteHeader />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</main>
      <footer className="mt-20 border-t olg-hairline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs text-silver">
          <p>© {new Date().getFullYear()} Omni Law Firm — Law Gazette.</p>
          <p className="font-jost tracking-[0.3em] uppercase text-[0.65rem]">omni · law firm</p>
        </div>
      </footer>
    </div>
  );
}
