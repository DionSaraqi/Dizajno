"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  FolderOpen,
  HelpCircle,
  LogIn,
  PlusSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import Scene from "@/components/three/Scene";
import { Logo } from "@/components/ui";

type NavItem = {
  num: string;
  icon: LucideIcon;
  label: string;
  href: string;
  enabled: boolean;
};

const navItems: NavItem[] = [
  { num: "01", icon: PlusSquare, label: "New design", href: "/designer", enabled: true },
  { num: "02", icon: FolderOpen, label: "My projects", href: "/projects", enabled: true },
  { num: "03", icon: BookOpen, label: "Templates", href: "#", enabled: false },
  { num: "04", icon: Settings, label: "Settings", href: "#", enabled: false },
  { num: "05", icon: HelpCircle, label: "Help & docs", href: "#", enabled: false },
];

export default function HomePage() {
  const router = useRouter();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    router.prefetch("/designer");
    router.prefetch("/projects");
  }, [router]);

  // Track cursor — drives the blueprint grid highlight + indigo aurora
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = mainRef.current;
    if (!el) return;
    el.style.setProperty("--mouse-x", `${e.clientX}px`);
    el.style.setProperty("--mouse-y", `${e.clientY}px`);
  }, []);

  return (
    <main
      ref={mainRef}
      onMouseMove={handleMouseMove}
      className="relative h-screen w-screen overflow-hidden blueprint-grid"
    >
      {/* Indigo aurora that tracks the cursor — layered on top of the
         blueprint grid's built-in mouse-follow highlight for warmth + depth. */}
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

      {/* 3D scene — pointer events on so the house can be dragged + door clicked.
         z-[3] keeps it above the blueprint-grid pseudo-elements (z 0/1) and aurora (z 2). */}
      <div className="absolute inset-0 z-[3]">
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-[11px] uppercase tracking-label text-dizajno-muted">
                Loading studio…
              </span>
            </div>
          }
        >
          <Canvas
            camera={{ position: [6, 6, 15], fov: 50 }}
            gl={{ alpha: true, antialias: true }}
            dpr={[1, 1.5]}
            style={{ background: "transparent" }}
          >
            <Scene />
          </Canvas>
        </Suspense>
      </div>

      {/* Corner crosshairs — pure decoration, sets the architectural tone */}
      <CornerCross className="top-6 left-6" />
      <CornerCross className="top-6 right-6" />
      <CornerCross className="bottom-6 left-6" />
      <CornerCross className="bottom-6 right-6" />

      {/* Top-left brand */}
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

      {/* Top-right meta row */}
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

      {/* Left nav — drawing index */}
      <nav className="absolute top-1/2 left-10 -translate-y-1/2 z-10 w-[290px]">
        <div
          className="mb-5 flex items-center gap-3 animate-slide-up"
          style={{ animationDelay: "160ms", animationFillMode: "backwards" }}
        >
          <span className="font-mono text-[10px] uppercase tracking-label text-dizajno-muted">
            Index
          </span>
          <span className="flex-1 h-px bg-dizajno-border" />
          <span className="font-mono text-[10px] uppercase tracking-label text-dizajno-muted-subtle">
            05
          </span>
        </div>

        <ul className="space-y-0.5">
          {navItems.map((item, i) => (
            <li
              key={item.label}
              className="animate-slide-up"
              style={{
                animationDelay: `${200 + i * 55}ms`,
                animationFillMode: "backwards",
              }}
            >
              <NavRow
                item={item}
                onClick={() => item.enabled && router.push(item.href)}
              />
            </li>
          ))}
        </ul>

        <div
          className="mt-5 pt-5 border-t border-dizajno-border animate-slide-up"
          style={{ animationDelay: "520ms", animationFillMode: "backwards" }}
        >
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="group inline-flex items-center gap-2 text-[13px] font-medium text-dizajno-text-subtle hover:text-dizajno-text transition-colors"
          >
            <LogIn size={14} strokeWidth={1.75} />
            <span>Sign in</span>
            <ArrowUpRight
              size={12}
              strokeWidth={2}
              className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-dizajno-accent transition-all duration-200"
            />
          </button>
        </div>
      </nav>

      {/* Bottom-right manifest */}
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

      {/* Bottom-center dimension-line hint */}
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
    </main>
  );
}

/* ---------- Sub-components ---------- */

function NavRow({
  item,
  onClick,
}: {
  item: NavItem;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!item.enabled}
      className={[
        "group relative w-full flex items-center gap-3 px-3 py-2.5 -mx-3 rounded-lg text-left",
        "transition-all duration-200 ease-out",
        item.enabled
          ? "cursor-pointer hover:bg-white hover:shadow-card-sm"
          : "cursor-default opacity-55",
      ].join(" ")}
    >
      <span className="w-6 font-mono text-[10.5px] tracking-label text-dizajno-muted-subtle group-hover:text-dizajno-accent transition-colors">
        {item.num}
      </span>

      <span
        className={[
          "flex h-7 w-7 items-center justify-center rounded-md border transition-all",
          item.enabled
            ? "border-dizajno-border bg-white/60 text-dizajno-text-subtle group-hover:border-dizajno-accent/30 group-hover:bg-dizajno-accent-soft group-hover:text-dizajno-accent"
            : "border-dizajno-border-subtle bg-transparent text-dizajno-muted-subtle",
        ].join(" ")}
      >
        <Icon size={14} strokeWidth={1.5} />
      </span>

      <span
        className={[
          "flex-1 min-w-0 text-[13.5px] font-medium tracking-tight transition-colors leading-snug",
          item.enabled ? "text-dizajno-text" : "text-dizajno-text-subtle",
        ].join(" ")}
      >
        {item.label}
      </span>

      {item.enabled ? (
        <ArrowUpRight
          size={14}
          strokeWidth={1.75}
          className="text-dizajno-muted-subtle opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-dizajno-accent transition-all duration-200"
        />
      ) : (
        <span className="font-mono text-[9px] uppercase tracking-label text-dizajno-muted-subtle">
          Soon
        </span>
      )}
    </button>
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
