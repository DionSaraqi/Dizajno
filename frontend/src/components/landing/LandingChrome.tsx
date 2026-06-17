/**
 * Decorative architectural layer: a cursor-tracking indigo aurora, a one-shot light
 * sweep on load, and corner crosshairs. Pure decoration — the aurora reads the
 * `--mouse-x` / `--mouse-y` CSS vars set on the page shell.
 */
export default function LandingChrome() {
  return (
    <>
      {/* Indigo aurora that tracks the cursor — layered on the blueprint grid for warmth + depth */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none z-[2]"
        style={{
          background:
            "radial-gradient(circle 320px at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(94, 99, 212, 0.10) 0%, rgba(94, 99, 212, 0.04) 35%, transparent 70%)",
        }}
      />

      {/* Single-pass light sweep on load — quick, dramatic, only fires once */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none z-[2] mix-blend-screen home-light-sweep"
      />

      {/* Corner crosshairs — sets the architectural tone */}
      <CornerCross className="top-6 left-6" />
      <CornerCross className="top-6 right-6" />
      <CornerCross className="bottom-6 left-6" />
      <CornerCross className="bottom-6 right-6" />
    </>
  );
}

function CornerCross({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute pointer-events-none z-[5] ${className}`} aria-hidden>
      <div className="relative h-2.5 w-2.5">
        <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-dizajno-border-strong/70" />
        <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-dizajno-border-strong/70" />
      </div>
    </div>
  );
}
