import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./content/**/*.mdx"],
  // Theme is applied as a `dark` class on <html> by the inline script in
  // app/layout.tsx (localStorage override, falls back to system preference).
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand: cream paper and dark wood, with a brass accent for links
        // and active states. Everything on the site derives from these.
        brand: {
          wood: "#5c3d2e",
          "wood-deep": "#3e2a1f", // hover / pressed
          "wood-soft": "#7b5a47",
          "wood-mist": "#f3ebe0", // soft tinted backgrounds
          "wood-ring": "#d8c7b4", // tinted borders / rings
          cream: "#f6efe3",
          "cream-soft": "#fbf8f2",
          "cream-deep": "#ece1cf",
          brass: "#a9843f",
          "brass-soft": "#c9a75f",
          red: "#b3261e",
        },
        // Lesson / progress statuses.
        status: {
          done: "#4f6f3a",
          "done-soft": "#eef3e8",
          warn: "#9a6b14",
        },
        // Primary text color for headings and emphasized copy.
        ink: "#1c1410",
      },
      borderRadius: {
        card: "1.25rem", // standard tiles & inner panels
        hero: "2rem", // large feature cards / page shells
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        brand: ["var(--font-brand)", "Montserrat", "var(--font-inter)", "sans-serif"],
        serif: [
          "var(--font-serif)",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
        mono: ["SF Mono", "ui-monospace", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      boxShadow: {
        glass:
          "0 8px 30px -12px rgba(62,42,31,0.18), inset 0 1px 0 0 rgba(255,255,255,0.7)",
        "glass-wood":
          "0 8px 32px rgba(92,61,46,0.14), inset 0 1px 0 0 rgba(255,255,255,0.7)",
      },
      backgroundImage: {
        "page-gradient":
          "linear-gradient(135deg, #fbf8f2 0%, #f6efe3 50%, #ece1cf 100%)",
      },
      typography: {
        DEFAULT: {
          css: {
            "--tw-prose-body": "#3a2c24",
            "--tw-prose-headings": "#1c1410",
            "--tw-prose-lead": "#5c3d2e",
            "--tw-prose-links": "#a9843f",
            "--tw-prose-bold": "#1c1410",
            "--tw-prose-counters": "#7b5a47",
            "--tw-prose-bullets": "#c9a75f",
            "--tw-prose-hr": "#d8c7b4",
            "--tw-prose-quotes": "#3e2a1f",
            "--tw-prose-quote-borders": "#c9a75f",
            "--tw-prose-captions": "#7b5a47",
            "--tw-prose-code": "#3e2a1f",
            "--tw-prose-th-borders": "#d8c7b4",
            "--tw-prose-td-borders": "#e8dccb",
            "--tw-prose-invert-body": "#e6dccf",
            "--tw-prose-invert-headings": "#f6efe3",
            "--tw-prose-invert-lead": "#d8c7b4",
            "--tw-prose-invert-links": "#c9a75f",
            "--tw-prose-invert-bold": "#f6efe3",
            "--tw-prose-invert-counters": "#c9a75f",
            "--tw-prose-invert-bullets": "#a9843f",
            "--tw-prose-invert-hr": "rgba(255,255,255,0.12)",
            "--tw-prose-invert-quotes": "#f6efe3",
            "--tw-prose-invert-quote-borders": "#a9843f",
            "--tw-prose-invert-captions": "#c9b8a3",
            "--tw-prose-invert-code": "#f6efe3",
            "--tw-prose-invert-th-borders": "rgba(255,255,255,0.15)",
            "--tw-prose-invert-td-borders": "rgba(255,255,255,0.08)",
          },
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
