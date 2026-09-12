"use client";

import { LazyMotion } from "framer-motion";

// The animation feature bundle loads async after hydration, so first-load
// JS carries only LazyMotion + the `m` component core instead of the full
// `motion` runtime. Until the chunk lands, `m` components render their
// initial styles; animations pick up the moment it does.
const loadFeatures = () =>
  import("@/components/motionFeatures").then((mod) => mod.default);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}
