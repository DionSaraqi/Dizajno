"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Cloud,
  CloudOff,
  FileText,
  Save,
  Share2,
} from "lucide-react";
import LeftDock from "@/components/designer/LeftDock";
import Toolbar from "@/components/designer/Toolbar";
import StatusBar from "@/components/designer/StatusBar";
import SelectionBar from "@/components/designer/SelectionBar";
import CanvasDropZone from "@/components/designer/CanvasDropZone";
import { DesignerProvider } from "@/components/designer/DesignerProvider";
import { ShareDialog } from "@/components/designer/ShareDialog";
import { RequestQuoteDialog } from "@/components/designer/RequestQuoteDialog";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDesignerStore } from "@/store/useDesignerStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useVariantLookup } from "@/hooks/useVariantLookup";
import { mapApiSceneToStore, mapStoreToApiScene } from "@/utils/sceneMapper";
import { reconcileLoadedFloors } from "@/utils/wallGraph";
import { captureCanvasThumbnail } from "@/utils/captureCanvas";
import * as api from "@/lib/api";
import { Logo, Spinner } from "@/components/ui";

const DrawingSurface = dynamic(
  () => import("@/components/three/DrawingSurface"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-dizajno-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-dizajno-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-dizajno-muted font-mono">
            Loading canvas...
          </span>
        </div>
      </div>
    ),
  }
);

type SaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 1500;
const THUMBNAIL_THROTTLE_MS = 30_000;

async function uploadThumbnail(projectId: string): Promise<void> {
  const blob = await captureCanvasThumbnail(800, 600);
  if (!blob) return;

  let presigned;
  try {
    presigned = await api.presignProjectThumbnail(projectId, {
      contentType: "image/png",
      sizeBytes: blob.size,
    });
  } catch (error) {
    if (error instanceof api.ApiError && error.status === 503) {
      // R2 not configured — silently no-op; the projects list already renders
      // a "NO THUMBNAIL" placeholder gracefully.
      return;
    }
    throw error;
  }

  // The presigned PUT goes directly to R2 — never the backend. We bypass
  // apiFetch so the bearer header isn't attached (R2 wouldn't recognise it).
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(presigned.requiredHeaders)) {
    headers[k] = v;
  }
  const put = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers,
    body: blob,
  });
  if (!put.ok) {
    throw new Error(`R2 upload failed: ${put.status}`);
  }

  await api.attachProjectThumbnail(projectId, {
    key: presigned.key,
    mimeType: "image/png",
    sizeBytes: blob.size,
  });
}

export default function ProjectDesignerPage() {
  useKeyboardShortcuts();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";
  const authStatus = useAuthStore((s) => s.status);
  const lookup = useVariantLookup();

  const [projectName, setProjectName] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hydrated, setHydrated] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  // Enable the Quote button as soon as the user has anything in the scene —
  // furniture, walls (so paint/flooring can be computed), or openings (branded
  // doors/windows are quoteable on their own). The dialog handles its own
  // empty-case copy once it's open.
  const placedCount = useDesignerStore((s) => s.furniture.length);
  const wallCount = useDesignerStore((s) => s.walls.length);
  const openingCount = useDesignerStore((s) => s.openings.length);
  const sceneHasContent = placedCount + wallCount + openingCount > 0;

  // We use refs for things the debounced effect needs without re-triggering it.
  const lookupRef = useRef(lookup);
  lookupRef.current = lookup;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const lastThumbnailAtRef = useRef(0);
  const thumbnailInFlightRef = useRef(false);

  // ── Auth gate ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace(`/login?redirect=/projects/${projectId}`);
    }
  }, [authStatus, projectId, router]);

  // ── Initial load: hydrate the store from the server scene ────────────────
  useEffect(() => {
    if (authStatus !== "authenticated" || !projectId) return;
    let cancelled = false;
    setHydrated(false);
    setLoadError(null);

    (async () => {
      try {
        const detail = await api.getProject(projectId);
        if (cancelled) return;
        const store = useDesignerStore.getState();
        const mapped = mapApiSceneToStore(detail.scene, lookupRef.current);
        // Re-derive floors from the walls so their geometry uses the current
        // inner-usable-polygon convention (self-heals projects saved under the
        // old centerline convention), carrying flooring assignments across.
        const floors = reconcileLoadedFloors(mapped.walls, mapped.floors);
        // Reset store, then push the mapped scene in. clearAll() resets
        // everything including selection/mode flags.
        store.clearAll();
        useDesignerStore.setState({
          walls: mapped.walls,
          floors,
          furniture: mapped.furniture,
          openings: mapped.openings,
        });
        setProjectName(detail.name);
        setHydrated(true);
        setSaveStatus("saved");
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : "Failed to load project"
        );
      }
    })();

    return () => {
      cancelled = true;
      // Defensive: when navigating away from this project, wipe the store so
      // the next project (or the standalone /designer) doesn't see stale state.
      useDesignerStore.getState().clearAll();
    };
  }, [projectId, authStatus]);

  // ── Debounced save: subscribe to scene-changing slices and PUT /scene ────
  useEffect(() => {
    if (!hydrated || !projectId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function schedule(): void {
      if (timer) clearTimeout(timer);
      setSaveStatus("saving");
      timer = setTimeout(async () => {
        timer = null;
        try {
          const state = useDesignerStore.getState();
          const { scene } = mapStoreToApiScene(
            {
              walls: state.walls,
              floors: state.floors,
              furniture: state.furniture,
              openings: state.openings,
            },
            lookupRef.current
          );
          await api.replaceScene(projectIdRef.current, scene);
          setSaveStatus("saved");

          // Fire-and-forget thumbnail upload, throttled to one every 30s and
          // never overlapping itself. Failures are silent — thumbnails are a
          // nice-to-have, not a save blocker.
          const now = Date.now();
          if (
            !thumbnailInFlightRef.current &&
            now - lastThumbnailAtRef.current >= THUMBNAIL_THROTTLE_MS
          ) {
            thumbnailInFlightRef.current = true;
            lastThumbnailAtRef.current = now;
            void uploadThumbnail(projectIdRef.current)
              .catch((err) => {
                // eslint-disable-next-line no-console
                console.warn("Thumbnail upload failed", err);
              })
              .finally(() => {
                thumbnailInFlightRef.current = false;
              });
          }
        } catch (error) {
          setSaveStatus("error");
          // eslint-disable-next-line no-console
          console.error("Scene save failed", error);
        }
      }, SAVE_DEBOUNCE_MS);
    }

    const unsubscribe = useDesignerStore.subscribe((state, prevState) => {
      if (
        state.walls !== prevState.walls ||
        state.floors !== prevState.floors ||
        state.furniture !== prevState.furniture ||
        state.openings !== prevState.openings
      ) {
        schedule();
      }
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [hydrated, projectId]);

  if (authStatus !== "authenticated") {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg">
        <div className="flex items-center gap-2 text-dizajno-muted text-sm">
          <Spinner /> Loading…
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen w-screen flex flex-col items-center justify-center gap-4 bg-dizajno-bg px-6">
        <div className="max-w-md w-full rounded-xl border border-dizajno-danger/30 bg-dizajno-danger-soft px-5 py-4">
          <p className="text-[13px] font-medium text-dizajno-danger">
            Couldn&apos;t load this project.
          </p>
          <p className="text-[12.5px] text-dizajno-danger/80 mt-1 break-words">
            {loadError}
          </p>
        </div>
        <Link
          href="/projects"
          className="text-[13px] text-dizajno-muted hover:text-dizajno-text transition-colors"
        >
          ← Back to projects
        </Link>
      </main>
    );
  }

  return (
    <DesignerProvider>
      <div className="w-full h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
        <header className="flex items-center gap-3 px-4 h-12 border-b border-white/[0.07] bg-zinc-950/95 backdrop-blur">
          <Link
            href="/projects"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors"
            aria-label="Back to projects"
          >
            <ArrowLeft size={15} />
          </Link>
          <div className="w-px h-5 bg-white/10" />
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 shrink-0 text-zinc-100"
            aria-label="Dizajno"
          >
            <Logo size={18} />
          </Link>
          <div className="flex-1 min-w-0 flex items-baseline gap-2">
            <span className="text-[13.5px] font-medium text-zinc-100 truncate">
              {projectName || "Loading…"}
            </span>
            <SaveBadge status={saveStatus} />
          </div>
          <button
            onClick={() => setQuoteOpen(true)}
            disabled={!sceneHasContent}
            title={
              !sceneHasContent
                ? "Add furniture, walls, or openings before requesting a quote"
                : undefined
            }
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-[12.5px] text-zinc-200 transition-colors"
          >
            <FileText size={13} /> Quote
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-white text-zinc-900 hover:bg-zinc-100 text-[12.5px] font-medium transition-colors"
          >
            <Share2 size={13} /> Share
          </button>
        </header>
        <ShareDialog
          projectId={projectId}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
        <RequestQuoteDialog
          projectId={projectId}
          open={quoteOpen}
          onClose={() => setQuoteOpen(false)}
        />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden relative">
          <LeftDock />
          <CanvasDropZone>
            <DrawingSurface />
          </CanvasDropZone>
          <SelectionBar />
        </div>
        <StatusBar />
      </div>
    </DesignerProvider>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-zinc-400">
        <Save size={11} className="animate-pulse" /> Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-emerald-400/90">
        <Cloud size={11} /> Saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-red-400">
        <CloudOff size={11} /> Save failed
      </span>
    );
  }
  return null;
}
