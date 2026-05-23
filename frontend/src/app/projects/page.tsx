"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  LogOut,
  ArrowLeft,
  FileText,
  Briefcase,
  ShieldCheck,
} from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?redirect=/projects");
    }
  }, [status, router]);

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects(),
    enabled: status === "authenticated",
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createProject(name),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.push(`/projects/${project.id}`);
    },
    onError: (error) => {
      setCreateError(error instanceof Error ? error.message : "Failed to create");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  function handleCreate(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setCreateError(null);
    const name = newName.trim();
    if (!name) {
      setCreateError("Please enter a name.");
      return;
    }
    createMutation.mutate(name);
  }

  async function handleLogout(): Promise<void> {
    await logout();
    router.push("/");
  }

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg blueprint-grid">
        <p className="font-mono text-sm text-dizajno-muted tracking-wider">
          Loading…
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-screen bg-dizajno-bg blueprint-grid">
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/10 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-dizajno-muted hover:text-dizajno-text transition"
            aria-label="Back to home"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-mono text-lg tracking-[0.2em] text-dizajno-text">
              MY PROJECTS
            </h1>
            <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
              {user?.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/quotes"
            className="flex items-center gap-2 px-3 py-1.5 rounded border border-white/10 hover:bg-white/5 text-dizajno-muted hover:text-dizajno-text font-mono text-xs tracking-wider transition"
          >
            <FileText size={14} /> Quotes
          </Link>
          {(user?.supplierMemberships?.length ?? 0) > 0 && (
            <Link
              href="/supplier/quotes"
              className="flex items-center gap-2 px-3 py-1.5 rounded border border-white/10 hover:bg-white/5 text-dizajno-muted hover:text-dizajno-text font-mono text-xs tracking-wider transition"
            >
              <Briefcase size={14} /> Inbox
            </Link>
          )}
          {user?.roles.includes("Admin") && (
            <Link
              href="/admin"
              className="flex items-center gap-2 px-3 py-1.5 rounded border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-mono text-xs tracking-wider transition"
            >
              <ShieldCheck size={14} /> Admin
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded border border-white/10 hover:bg-white/5 text-dizajno-muted hover:text-dizajno-text font-mono text-xs tracking-wider transition"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-8 py-10">
        <form
          onSubmit={handleCreate}
          className="flex gap-2 mb-10 rounded-lg border border-white/10 bg-black/30 backdrop-blur p-4"
        >
          <input
            type="text"
            placeholder="New project name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-dizajno-text focus:border-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex items-center gap-2 rounded bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-50 px-4 py-2 font-mono text-xs tracking-wider text-dizajno-text transition"
          >
            <Plus size={14} />
            {createMutation.isPending ? "Creating…" : "New project"}
          </button>
        </form>

        {createError && (
          <p className="-mt-6 mb-6 font-mono text-[11px] text-red-400">{createError}</p>
        )}

        {projects.isLoading && (
          <p className="font-mono text-sm text-dizajno-muted">Loading projects…</p>
        )}
        {projects.error && (
          <p className="font-mono text-sm text-red-400 break-words">
            Failed to load projects: {(projects.error as Error).message}
          </p>
        )}
        {projects.data && projects.data.length === 0 && (
          <p className="font-mono text-sm text-dizajno-muted">
            No projects yet. Create one above to start designing.
          </p>
        )}

        {projects.data && projects.data.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.data.map((project) => (
              <li
                key={project.id}
                className="group rounded-lg border border-white/10 bg-black/30 hover:bg-black/40 backdrop-blur overflow-hidden transition"
              >
                <Link
                  href={`/projects/${project.id}`}
                  className="block aspect-video relative"
                >
                  {project.thumbnailUrl ? (
                    // Plain <img> is fine here — thumbnails are arbitrary R2 URLs.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.thumbnailUrl}
                      alt={project.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-dizajno-muted font-mono text-xs tracking-widest opacity-50">
                      NO THUMBNAIL
                    </div>
                  )}
                </Link>
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex-1 min-w-0"
                  >
                    <p className="font-mono text-sm text-dizajno-text truncate">
                      {project.name}
                    </p>
                    <p className="font-mono text-[10px] tracking-widest text-dizajno-muted/70 uppercase mt-0.5">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                  </Link>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Delete "${project.name}"? It can be recovered from the database for 30 days.`
                        )
                      ) {
                        deleteMutation.mutate(project.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition text-dizajno-muted hover:text-red-400 p-2"
                    aria-label="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
