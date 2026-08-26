"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Box, Eye, MessageSquare, Square } from "lucide-react";
import { useDesignerStore, useIs3D } from "@/store/useDesignerStore";
import { useVariantLookup } from "@/hooks/useVariantLookup";
import { mapApiSceneToStore } from "@/utils/sceneMapper";
import { reconcileLoadedFloors } from "@/utils/wallGraph";
import * as api from "@/lib/api";
import DesignerHeader from "@/components/designer/DesignerHeader";
import { CommentsPanel } from "@/components/share/CommentsPanel";
import { Button, ErrorState, Spinner } from "@/components/ui";

const DrawingSurface = dynamic(
  () => import("@/components/three/DrawingSurface"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-dizajno-bg">
        <div className="flex items-center gap-2 text-dizajno-muted text-sm">
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

  const [loadError, setLoadError] = useState<unknown>(null);
  const [hydrated, setHydrated] = useState(false);
  const [project, setProject] = useState<api.SharedProject | null>(null);

  // Ref so the hydrate effect can read the latest lookup without depending on
  // its identity — the memo gets a new reference on every catalog refetch with
  // changed content, and re-running the effect would blank + reload the viewer.
  const lookupRef = useRef(lookup);
  lookupRef.current = lookup;

  useEffect(() => {
    // Wait for the catalog fetch to settle — mapping against an empty variant
    // lookup would drop every placed item from the read-only view. A settled
    // error is fatal for the same reason; React Query refetches on focus/
    // reconnect, so recovery re-runs this effect.
    if (!token || !lookup.isReady) return;
    if (lookup.isError) {
      setHydrated(false);
      setLoadError(
        new Error("The furniture catalog failed to load — try again in a moment."),
      );
      return;
    }
    let cancelled = false;
    setHydrated(false);
    setLoadError(null);

    (async () => {
      try {
        const detail = await api.loadSharedProject(token);
        if (cancelled) return;
        const mapped = mapApiSceneToStore(detail.scene, lookupRef.current);
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
        // A 404 here has one meaning worth spelling out, which beats the
        // generic not-found copy. Everything else is already human by the time
        // it reaches us.
        setLoadError(
          error instanceof api.ApiError && error.status === 404
            ? new Error("This share link is invalid, revoked, or expired.")
            : error,
        );
      }
    })();

    return () => {
      cancelled = true;
      useDesignerStore.getState().clearAll();
    };
  }, [token, lookup.isReady, lookup.isError]);

  if (loadError != null) {
    return (
      <main className="min-h-screen w-screen flex flex-col items-center justify-center gap-4 bg-dizajno-bg px-6">
        <div className="max-w-md w-full">
          <ErrorState error={loadError} action="load this share" />
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
    <div className="w-full h-screen flex flex-col bg-dizajno-bg overflow-hidden">
      <DesignerHeader
        backHref="/"
        backLabel="Back home"
        title={project.name}
        badge={
          <span className="inline-flex items-center gap-1 text-[11.5px] text-dizajno-muted">
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
        }
        actions={
          <Button
            variant={is3D ? "secondary" : "ghost"}
            size="sm"
            onClick={toggleIs3D}
            aria-pressed={is3D}
            leftIcon={is3D ? <Box /> : <Square />}
          >
            {is3D ? "3D" : "2D"}
          </Button>
        }
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <DrawingSurface />
        </div>
        <CommentsPanel token={token} mode={project.mode} />
      </div>
    </div>
  );
}
