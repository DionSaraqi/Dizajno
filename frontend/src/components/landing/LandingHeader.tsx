import { Logo } from "@/components/ui";

/** Top-left brand mark + top-right meta/status row. */
export default function LandingHeader() {
  return (
    <>
      <header
        className="absolute top-7 left-10 z-10 flex items-center gap-3 pointer-events-none animate-slide-up"
        style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
      >
        <Logo size={26} />
        <div className="flex flex-col leading-none">
          <span className="text-[17px] font-semibold tracking-tight text-dizajno-text">
            Dizajno
          </span>
          <span className="mt-1.5 font-mono text-[10px] uppercase tracking-label text-dizajno-muted">
            Browser-based room designer
          </span>
        </div>
      </header>

      <div
        className="absolute top-8 right-10 z-10 flex items-center gap-3 pointer-events-none font-mono text-[10px] uppercase tracking-label text-dizajno-muted animate-slide-up"
        style={{ animationDelay: "120ms", animationFillMode: "backwards" }}
      >
        <span>v1.0.0</span>
        <Dot />
        <span>24 · 05 · 26</span>
        <Dot />
        <span className="flex items-center gap-1.5 text-dizajno-text-subtle">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-dizajno-success opacity-70 animate-ping" />
            <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-dizajno-success" />
          </span>
          Studio online
        </span>
      </div>
    </>
  );
}

function Dot() {
  return (
    <span
      aria-hidden
      className="inline-block w-1 h-1 rounded-full bg-dizajno-muted-subtle"
    />
  );
}
