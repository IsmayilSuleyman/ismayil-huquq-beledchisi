/**
 * Fixed-position decorative layer rendering large blurred brass and wood
 * "orbs" that drift slowly behind the page content.
 *
 * Pure CSS keyframes (see globals.css `orb-drift-*`): the compositor handles
 * a transform keyframe for free. Server component — zero client JS.
 */
export function PageBackground() {
  return (
    <div
      aria-hidden
      // Orbs are tuned for the cream gradient; dim them in dark mode so they
      // read as a faint warm glow instead of bright patches.
      // `page-orbs`: hidden on iOS WebKit (see the crash-mitigation block in
      // globals.css).
      className="page-orbs pointer-events-none fixed inset-0 -z-10 overflow-hidden dark:opacity-30"
    >
      <div
        className="orb-drift-1 absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(169,132,63,0.16) 0%, rgba(169,132,63,0) 65%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="orb-drift-2 absolute top-1/3 -right-40 h-[640px] w-[640px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(92,61,46,0.12) 0%, rgba(92,61,46,0) 65%)",
          filter: "blur(50px)",
        }}
      />
      <div
        className="orb-drift-3 absolute -bottom-40 left-1/4 h-[480px] w-[480px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(201,167,95,0.12) 0%, rgba(201,167,95,0) 65%)",
          filter: "blur(45px)",
        }}
      />
    </div>
  );
}
