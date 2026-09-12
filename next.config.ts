import type { NextConfig } from "next";

// Origin of the gazette deployment (its app runs with basePath /gazette).
const GAZETTE_ORIGIN = (
  process.env.GAZETTE_ORIGIN ?? "https://omnilawgazette.vercel.app"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Course content is read from disk at request time; make sure the MDX
  // files ship with the server functions that render them on Vercel.
  outputFileTracingIncludes: {
    "/": ["./content/**/*"],
    "/courses": ["./content/**/*"],
    "/courses/[course]": ["./content/**/*"],
    "/courses/[course]/[lesson]": ["./content/**/*"],
    "/account": ["./content/**/*"],
  },
  // Omni Law Gazette is a separate Next.js app mounted under /gazette
  // (multi-zone): every request below that path is proxied to it.
  async rewrites() {
    return [
      { source: "/gazette", destination: `${GAZETTE_ORIGIN}/gazette` },
      { source: "/gazette/:path*", destination: `${GAZETTE_ORIGIN}/gazette/:path*` },
    ];
  },
  // Gazette covers are served from the public Supabase storage bucket.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
