import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";
import { PageBackground } from "@/components/PageBackground";
import { MotionProvider } from "@/components/MotionProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileTabBar } from "@/components/MobileTabBar";

// Runs before paint: applies the persisted theme (or the system preference)
// as a `dark` class on <html> so there is no light-flash on load.
const themeInitScript = `(function(){var t=null;try{t=localStorage.getItem("theme")}catch(e){}var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)})();`;

// Body face: SF Pro Display on Apple devices (system font), Inter elsewhere.
// Inter is self-hosted via next/font; latin-ext covers the Azerbaijani
// letters (ə, ı, ş, ğ, ö, ü, ç).
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

// Brand face for the wordmark only: Nunito Extra Bold, as in the logo.
const brand = Nunito({
  subsets: ["latin", "latin-ext"],
  weight: ["800"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "İsmayıl Hüquq Bələdçisi",
    template: "%s · İsmayıl Hüquq Bələdçisi",
  },
  description:
    "Azərbaycan dilində hüquq təhsili platforması: dərslər, testlər və hüquqi bilik.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efe3" },
    { media: "(prefers-color-scheme: dark)", color: "#14100d" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="az"
      className={`${inter.variable} ${brand.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="relative isolate font-sans">
        <MotionProvider>
          <PageBackground />
          <div className="relative z-10 min-h-screen">{children}</div>
          <MobileTabBar />
          <ThemeToggle />
        </MotionProvider>
      </body>
    </html>
  );
}
