"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Box,
  Eye,
  MessageSquare,
  Square,
} from "lucide-react";
import { useDesignerStore, useIs3D } from "@/store/useDesignerStore";
import { useVariantLookup } from "@/hooks/useVariantLookup";
import { mapApiSceneToStore } from "@/utils/sceneMapper";
import { reconcileLoadedFloors } from "@/utils/wallGraph";
import * as api from "@/lib/api";
import { CommentsPanel } from "@/components/share/CommentsPanel";
import { Logo, Spinner } from "@/components/ui";

const DrawingSurface = dynamic(
  () => import("@/components/three/DrawingSurface"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <Spinner /> Loading shared scene…
        </div>
      </div>
    ),
  },
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
        // Re-derive floors from walls so old centerline-convention scenes render
        // at the correct inner-usable size in the read-only viewer.
        const floors = reconcileLoadedFloors(mapped.walls, mapped.floors);
        const store = useDesignerStore.getState();
        store.clearAll();
        useDesignerStore.setState({
          walls: mapped.walls,
          floors,
          furniture: mapped.furniture,
          openings: mapped.openings,
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
      <main className="min-h-screen w-screen flex flex-col items-center justify-center gap-4 bg-dizajno-bg px-6">
        <div className="max-w-md w-full rounded-xl border border-dizajno-danger/30 bg-dizajno-danger-soft px-5 py-4 text-center">
          <p className="text-[13px] font-medium text-dizajno-danger">
            Couldn&apos;t load this share
          </p>
          <p className="text-[12.5px] text-dizajno-danger/80 mt-1">
            {loadError}
          </p>
        </div>
        <Link
          href="/"
          className="text-[13px] text-dizajno-muted hover:text-dizajno-text transition-colors"
        >
          ← Back home
        </Link>
      </main>
    );
  }

  if (!hydrated || !project) {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg">
        <div className="flex items-center gap-2 text-dizajno-muted text-sm">
          <Spinner /> Loading…
        </div>
      </main>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      <header className="flex items-center gap-3 px-4 h-12 border-b border-white/[0.07] bg-zinc-950/95 backdrop-blur">
        <Link
          href="/"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors"
          aria-label="Back home"
        >
          <ArrowLeft size={15} />
        </Link>
        <div className="w-px h-5 bg-white/10" />
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 shrink-0 text-zinc-100"
          aria-label="Dizajno"
        >
          <Logo size={18} />
        </Link>
        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          <span className="text-[13.5px] font-medium text-zinc-100 truncate">
            {project.name}
          </span>
          <span className="inline-flex items-center gap-1 text-[11.5px] text-zinc-400">
            {project.mode === "Comment" ? (
              <>
                <MessageSquare size={11} /> Comment access
              </>
            ) : (
              <>
                <Eye size={11} /> View only
              </>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={toggleIs3D}
          aria-pressed={is3D}
          className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[12.5px] font-medium transition-colors ${
            is3D
              ? "bg-white/10 border border-white/20 text-zinc-100"
              : "bg-white/[0.04] border border-white/10 text-zinc-200 hover:bg-white/[0.08]"
          }`}
        >
          {is3D ? <Box size={13} /> : <Square size={13} />}
          {is3D ? "3D" : "2D"}
        </button>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <DrawingSurface />
        </div>
        <CommentsPanel token={token} mode={project.mode} />
      </div>
    </div>
  );
}
