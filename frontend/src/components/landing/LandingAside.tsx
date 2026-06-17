/** Bottom-right studio manifest + bottom-center "drag / click the door" hint. */
export default function LandingAside() {
  return (
    <>
      <div
        className="absolute bottom-9 right-10 z-10 max-w-[240px] pointer-events-none animate-slide-up"
        style={{ animationDelay: "620ms", animationFillMode: "backwards" }}
      >
        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-dizajno-muted">
          <span className="w-3 h-px bg-dizajno-accent" />
          The studio
        </div>
        <p className="text-[12.5px] leading-relaxed text-dizajno-text-subtle">
          Draw rooms in 2D, walk them in 3D, and source the furniture from the
          suppliers behind the pixels.
        </p>
      </div>

      <div
        className="absolute bottom-9 left-1/2 -translate-x-1/2 z-10 pointer-events-none animate-fade-in"
        style={{ animationDelay: "780ms", animationFillMode: "backwards" }}
      >
        <div className="flex items-center gap-4 font-mono text-[11px] tracking-wider text-dizajno-muted">
          <DimensionTick side="left" />
          <span className="whitespace-nowrap">
            Drag to rotate
            <span className="mx-2 text-dizajno-muted-subtle">·</span>
            Click the
            <span className="mx-1 inline-block w-1.5 h-1.5 rounded-full bg-dizajno-accent align-middle" />
            door to begin
          </span>
          <DimensionTick side="right" />
        </div>
      </div>
    </>
  );
}

function DimensionTick({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden
      className={[
        "relative flex items-center",
        side === "left" ? "flex-row" : "flex-row-reverse",
      ].join(" ")}
    >
      <span className="h-px w-16 bg-dizajno-border" />
      <span className="h-2 w-px bg-dizajno-border" />
    </span>
  );
}
