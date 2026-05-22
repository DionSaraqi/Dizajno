"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Box, Eye, MessageSquare, Square } from "lucide-react";
import { useDesignerStore, useIs3D } from "@/store/useDesignerStore";
import { useVariantLookup } from "@/hooks/useVariantLookup";
import { mapApiSceneToStore } from "@/utils/sceneMapper";
import * as api from "@/lib/api";
import { CommentsPanel } from "@/components/share/CommentsPanel";

const DrawingSurface = dynamic(
  () => import("@/components/three/DrawingSurface"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-dizajno-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-dizajno-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-dizajno-muted font-mono">
            Loading shared scene…
          </span>
        </div>
      </div>
    ),
  }
);

export default function SharedProjectPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const lookup = useVariantLookup();
  const is3D = useIs3D();
  const toggleIs3D = useDesignerStore((s) => s.toggleIs3D);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [project, setProject] = useState<api.SharedProject | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setHydrated(false);
    setLoadError(null);

    (async () => {
      try {
        const detail = await api.loadSharedProject(token);
        if (cancelled) return;
        const mapped = mapApiSceneToStore(detail.scene, lookup);
        const store = useDesignerStore.getState();
        store.clearAll();
        useDesignerStore.setState({
          walls: mapped.walls,
          floors: mapped.floors,
          furniture: mapped.furniture,
          openings: mapped.openings,
          // Public viewer is always read-only — start in select mode with
          // nothing drawn-from. `readOnly` blocks pointer-driven edits
          // (furniture drag, opening drag) even when items are selected.
          mode: "select",
          readOnly: true,
        });
        setProject(detail);
        setHydrated(true);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof api.ApiError && error.status === 404
            ? "This share link is invalid, revoked, or expired."
            : error instanceof Error
              ? error.message
              : "Failed to load shared project.";
        setLoadError(message);
      }
    })();

    return () => {
      cancelled = true;
      useDesignerStore.getState().clearAll();
    };
  }, [token, lookup]);

  if (loadError) {
    return (
      <main className="min-h-screen w-screen flex flex-col items-center justify-center gap-4 bg-dizajno-bg">
        <p className="font-mono text-sm text-red-400">{loadError}</p>
        <Link
          href="/"
          className="font-mono text-xs tracking-wider text-dizajno-muted underline"
        >
          Back home
        </Link>
      </main>
    );
  }

  if (!hydrated || !project) {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg">
        <p className="font-mono text-sm text-dizajno-muted tracking-wider">
          Loading…
        </p>
      </main>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-dizajno-bg overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-2 border-b border-white/10 bg-black/30 backdrop-blur">
        <Link
          href="/"
          className="text-dizajno-muted hover:text-dizajno-text transition"
          aria-label="Back home"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm text-dizajno-text truncate">
            {project.name}
          </p>
          <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase mt-0.5">
            shared {project.mode === "Comment" ? "with comments" : "read-only"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleIs3D}
          aria-pressed={is3D}
          className={`flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase transition
            ${
              is3D
                ? "border-white/40 bg-white/10 text-dizajno-text"
                : "border-white/10 text-dizajno-muted hover:text-dizajno-text hover:bg-white/5"
            }`}
        >
          {is3D ? <Box size={12} /> : <Square size={12} />}
          <span>{is3D ? "3D" : "2D"}</span>
        </button>
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-dizajno-muted">
          {project.mode === "Comment" ? (
            <>
              <MessageSquare size={12} /> Comment mode
            </>
          ) : (
            <>
              <Eye size={12} /> View only
            </>
          )}
        </span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          {/* Read-only by construction: no Toolbar, no Sidebar — there's no UI
              surface that flips the store out of "select" mode, so visitors
              can't draw, place, or punch openings. They can still pan/orbit
              the camera and click items (no-op since no Properties panel). */}
          <DrawingSurface />
        </div>
        <CommentsPanel token={token} mode={project.mode} />
      </div>
    </div>
  );
}
