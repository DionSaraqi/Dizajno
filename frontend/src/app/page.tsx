"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import LandingChrome from "@/components/landing/LandingChrome";
import LandingCanvas from "@/components/landing/LandingCanvas";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingNav from "@/components/landing/LandingNav";
import LandingAside from "@/components/landing/LandingAside";

/**
 * Landing page shell. Owns the blueprint-grid backdrop + cursor tracking (which drives
 * the grid highlight and the aurora in <LandingChrome>) and composes the landing sections.
 * Each section lives in its own file under components/landing/.
 */
export default function HomePage() {
  const router = useRouter();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    router.prefetch("/designer");
    router.prefetch("/projects");
    router.prefetch("/login");
  }, [router]);

  // Track cursor — drives the blueprint grid highlight + indigo aurora via CSS vars.
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
      <LandingChrome />
      <LandingCanvas />
      <LandingHeader />
      <LandingNav />
      <LandingAside />
    </main>
  );
}
