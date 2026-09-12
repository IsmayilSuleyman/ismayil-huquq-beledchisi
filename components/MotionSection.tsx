"use client";

import { m, type HTMLMotionProps } from "framer-motion";

type MotionSectionProps = HTMLMotionProps<"section"> & {
  delay?: number;
};

/**
 * Wrapper around <section> that fades + slides in once it scrolls into view.
 * Gives page sections a staggered reveal.
 */
export function MotionSection({
  children,
  delay = 0,
  ...rest
}: MotionSectionProps) {
  return (
    <m.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
      {...rest}
    >
      {children}
    </m.section>
  );
}
