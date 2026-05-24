"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Briefcase,
  ShieldCheck,
  Frame,
  LayoutGrid,
} from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
  TopBar,
  Modal,
} from "@/components/ui";

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [newName, setNewName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDeleteTarget(null);
    },
  });

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    const name = newName.trim();
    if (!name) {
      setCreateError("Please enter a name.");
      return;
    }
    createMutation.mutate(name);
  }

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  if (status !== "authenticated" || !user) {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg">
        <p className="text-sm text-dizajno-muted">Loading…</p>
      </main>
    );
  }

  const hasSupplier = (user.supplierMemberships?.length ?? 0) > 0;
  const isAdmin = user.roles.includes("Admin");

  return (
    <div className="min-h-screen w-screen bg-dizajno-bg">
      <TopBar
        links={[
          { label: "Projects", href: "/projects", active: true },
          { label: "Quotes", href: "/quotes" },
        ]}
        actions={
          <>
            {hasSupplier && (
              <Link href="/supplier">
                <Button variant="secondary" size="sm" leftIcon={<Briefcase />}>
                  Supplier portal
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<ShieldCheck />}
                >
                  Admin
                </Button>
              </Link>
            )}
          </>
        }
        user={{ displayName: user.displayName, email: user.email }}
        onSignOut={handleLogout}
      />

      <div className="max-w-6xl mx-auto px-6">
        <PageHeader
          eyebrow={`Welcome${user.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}`}
          title="Your projects"
          description="Start a fresh room, continue a draft, or hop into the supplier portal to manage your catalog."
          actions={
            <Button
              variant="primary"
              leftIcon={<Plus />}
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
            >
              New project
            </Button>
          }
        />

        <section className="py-8">
          {projects.isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <Card key={i} flush>
                  <Skeleton className="aspect-[4/3] rounded-t-xl" />
                  <div className="px-4 py-3.5 space-y-2">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {projects.error && (
            <div className="rounded-xl border border-dizajno-danger/30 bg-dizajno-danger-soft px-4 py-3 text-[13px] text-dizajno-danger">
              Failed to load projects: {(projects.error as Error).message}
            </div>
          )}

          {projects.data && projects.data.length === 0 && (
            <EmptyState
              icon={<Frame />}
              title="No projects yet"
              description="Create your first room to start drawing walls, placing furniture, and sourcing materials."
              action={
                <Button
                  variant="primary"
                  leftIcon={<Plus />}
                  onClick={() => setCreateOpen(true)}
                >
                  New project
                </Button>
              }
            />
          )}

          {projects.data && projects.data.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.data.map((project) => (
                <li key={project.id} className="group">
                  <Card flush className="overflow-hidden transition-shadow hover:shadow-card">
                    <Link
                      href={`/projects/${project.id}`}
                      className="block aspect-[4/3] relative bg-dizajno-elevated border-b border-dizajno-border overflow-hidden"
                    >
                      {project.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={project.thumbnailUrl}
                          alt={project.name}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-dizajno-muted-subtle">
                          <LayoutGrid
                            size={24}
                            className="mb-2 opacity-60"
                            strokeWidth={1.4}
                          />
                          <span className="text-[10.5px] font-medium uppercase tracking-label">
                            No preview
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-zinc-950/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    <div className="flex items-center justify-between gap-2 px-4 py-3.5">
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex-1 min-w-0"
                      >
                        <p className="text-[14px] font-medium text-dizajno-text truncate group-hover:text-dizajno-accent transition-colors">
                          {project.name}
                        </p>
                        <p className="text-[11.5px] text-dizajno-muted mt-0.5">
                          {formatRelativeDate(project.updatedAt)}
                        </p>
                      </Link>
                      <button
                        onClick={() =>
                          setDeleteTarget({
                            id: project.id,
                            name: project.name,
                          })
                        }
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-dizajno-muted hover:text-dizajno-danger p-1.5 rounded-md hover:bg-dizajno-danger-soft"
                        aria-label={`Delete ${project.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* New project modal */}
      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setNewName("");
          setCreateError(null);
        }}
        title="New project"
        description="Name it anything — you can rename it later."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setCreateOpen(false);
                setNewName("");
              }}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createMutation.isPending}
              onClick={() =>
                handleCreate(
                  new Event("submit") as unknown as React.FormEvent<HTMLFormElement>,
                )
              }
            >
              Create
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            autoFocus
            placeholder="e.g. Studio loft — Tirana"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          {createError && (
            <p className="text-[12px] text-dizajno-danger">{createError}</p>
          )}
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete project?`}
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be moved to trash. It can be recovered from the database for 30 days.`
            : ""
        }
        confirmLabel="Delete project"
        confirmTone="danger"
        busy={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}
