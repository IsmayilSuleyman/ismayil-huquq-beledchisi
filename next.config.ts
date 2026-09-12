import type { NextConfig } from "next";

const GAZETTE_URL = (
  process.env.NEXT_PUBLIC_GAZETTE_URL ?? "https://omnilawgazette.vercel.app"
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
  // The gazette is its own site; anything that pointed at the short-lived
  // in-guide section forwards there.
  async redirects() {
    return [
      { source: "/gazette", destination: GAZETTE_URL, permanent: false },
      { source: "/gazette/admin", destination: `${GAZETTE_URL}/admin`, permanent: false },
      { source: "/gazette/:number(\\d+)", destination: `${GAZETTE_URL}/issues/:number`, permanent: false },
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
