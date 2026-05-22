"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Cloud, CloudOff, Save } from "lucide-react";
import Sidebar from "@/components/designer/Sidebar";
import Toolbar from "@/components/designer/Toolbar";
import StatusBar from "@/components/designer/StatusBar";
import CanvasDropZone from "@/components/designer/CanvasDropZone";
import { DesignerProvider } from "@/components/designer/DesignerProvider";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDesignerStore } from "@/store/useDesignerStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useVariantLookup } from "@/hooks/useVariantLookup";
import { mapApiSceneToStore, mapStoreToApiScene } from "@/utils/sceneMapper";
import * as api from "@/lib/api";

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

  // We use refs for things the debounced effect needs without re-triggering it.
  const lookupRef = useRef(lookup);
  lookupRef.current = lookup;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

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
        // Reset store, then push the mapped scene in. clearAll() resets
        // everything including selection/mode flags.
        store.clearAll();
        useDesignerStore.setState({
          walls: mapped.walls,
          floors: mapped.floors,
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
        <p className="font-mono text-sm text-dizajno-muted tracking-wider">
          Loading…
        </p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen w-screen flex flex-col items-center justify-center gap-4 bg-dizajno-bg">
        <p className="font-mono text-sm text-red-400">{loadError}</p>
        <Link
          href="/projects"
          className="font-mono text-xs tracking-wider text-dizajno-muted underline"
        >
          Back to projects
        </Link>
      </main>
    );
  }

  return (
    <DesignerProvider>
      <div className="w-full h-screen flex flex-col bg-dizajno-bg overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-2 border-b border-white/10 bg-black/30 backdrop-blur">
          <Link
            href="/projects"
            className="text-dizajno-muted hover:text-dizajno-text transition"
            aria-label="Back to projects"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-sm text-dizajno-text truncate">
              {projectName || "Loading…"}
            </p>
          </div>
          <SaveBadge status={saveStatus} />
        </div>
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <CanvasDropZone>
            <DrawingSurface />
          </CanvasDropZone>
        </div>
        <StatusBar />
      </div>
    </DesignerProvider>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-dizajno-muted">
        <Save size={12} className="animate-pulse" /> Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-emerald-400/80">
        <Cloud size={12} /> Saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-red-400">
        <CloudOff size={12} /> Save failed
      </span>
    );
  }
  return null;
}
