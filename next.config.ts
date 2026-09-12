import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Course content is read from disk at request time; make sure the MDX
  // files ship with the server functions that render them on Vercel.
  outputFileTracingIncludes: {
    "/courses": ["./content/**/*"],
    "/courses/[course]": ["./content/**/*"],
    "/courses/[course]/[lesson]": ["./content/**/*"],
    "/account": ["./content/**/*"],
  },
};

export default nextConfig;
