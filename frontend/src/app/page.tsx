"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogIn,
  FolderOpen,
  PlusSquare,
  Settings,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import Scene from "@/components/three/Scene";

const menuItems = [
  { icon: PlusSquare, label: "New Design", href: "/designer", enabled: true },
  { icon: FolderOpen, label: "My Projects", href: "#", enabled: false },
  { icon: BookOpen, label: "Templates", href: "#", enabled: false },
  { icon: Settings, label: "Settings", href: "#", enabled: false },
  { icon: HelpCircle, label: "Help & Docs", href: "#", enabled: false },
  { icon: LogIn, label: "Sign In", href: "/login", enabled: true },
];

export default function HomePage() {
  const router = useRouter();
  const mainRef = useRef<HTMLElement>(null);
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);

  // Prefetch the designer route on mount
  useEffect(() => {
    router.prefetch("/designer");
  }, [router]);

  // Track mouse position for grid glow effect
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
      className="relative h-screen w-screen m-0 p-0 overflow-hidden blueprint-grid"
    >
      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-dizajno-muted font-mono text-sm tracking-wider">
                Loading...
              </div>
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

      {/* Top-left: Logo + tagline */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none select-none">
        <h1 className="font-mono text-3xl font-bold tracking-[0.2em] text-dizajno-text">
          DIZAJNO
        </h1>
        <p className="font-mono text-xs tracking-wider text-dizajno-muted mt-1">
          browser-based room designer
        </p>
      </div>

      {/* Left side: Navigation Menu */}
      <div className="absolute top-0 left-0 bottom-0 z-10 flex flex-col justify-center py-8 px-8 pointer-events-none">
        <nav className="pointer-events-auto flex flex-col gap-1 -mt-8">
          {menuItems.map((item, i) => {
            const Icon = item.icon;
            const isHovered = hoveredItem === i;
            return (
              <button
                key={item.label}
                onClick={() => item.enabled && router.push(item.href)}
                onMouseEnter={() => setHoveredItem(i)}
                onMouseLeave={() => setHoveredItem(null)}
                disabled={!item.enabled}
                className={`
                  group flex items-center gap-3 py-2.5 px-3 rounded-md text-left
                  transition-all duration-200 ease-out
                  ${item.enabled
                    ? "cursor-pointer"
                    : "cursor-default opacity-35"
                  }
                  ${isHovered && item.enabled
                    ? "bg-white/[0.06] translate-x-1"
                    : ""
                  }
                `}
              >
                {/* Accent line */}
                <div
                  className={`
                    w-0.5 h-5 rounded-full transition-all duration-200
                    ${isHovered && item.enabled
                      ? "bg-white"
                      : "bg-slate-500/40"
                    }
                  `}
                />
                <Icon
                  size={16}
                  strokeWidth={1.5}
                  className={`
                    transition-colors duration-200
                    ${isHovered && item.enabled
                      ? "text-white"
                      : "text-slate-300"
                    }
                  `}
                />
                <span
                  className={`
                    font-mono text-[13px] tracking-wider
                    transition-colors duration-200
                    ${isHovered && item.enabled
                      ? "text-white"
                      : "text-slate-300"
                    }
                  `}
                >
                  {item.label}
                </span>

                {/* "Coming soon" tag for disabled items */}
                {!item.enabled && (
                  <span className="font-mono text-[9px] tracking-widest uppercase text-slate-600 ml-auto">
                    soon
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom center: hint text */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none select-none">
        <p className="font-mono text-sm text-dizajno-muted tracking-wider opacity-70">
          Drag to rotate &middot; Click the door to start designing
        </p>
      </div>

      {/* Version */}
      <div className="absolute top-8 right-8 z-10 pointer-events-none select-none">
        <p className="font-mono text-[10px] text-dizajno-muted opacity-40 tracking-widest">
          v1.0
        </p>
      </div>
    </main>
  );
}
