import type { NextConfig } from "next";

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
  // pdf.js probes for the optional `canvas` package; it is browser-only
  // here, so tell webpack not to try resolving it.
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default nextConfig;
