import type { MetadataRoute } from "next";

// Lets the gazette be added to a phone's home screen. iPhones deliver push
// notifications only to sites opened from there.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Omni Law Gazette",
    short_name: "Law Gazette",
    description: "Weekly legislature digest of Omni Law Firm.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#05080f",
    theme_color: "#05080f",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
