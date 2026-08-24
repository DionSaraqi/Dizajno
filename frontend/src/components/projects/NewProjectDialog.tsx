"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { Button, Input, Modal } from "@/components/ui";

export interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Runs after the project row exists but *before* navigation, with the dialog
   * held in its loading state throughout. Used by the designer to push the
   * current scene into the new project — navigating first would let the target
   * page's `clearAll()` + hydrate wipe the store while the server still holds
   * an empty scene. Throwing keeps the dialog open with the message shown; the
   * already-created project is reused on retry rather than creating another.
   */
  afterCreate?: (project: api.ProjectDetail) => Promise<void>;
  title?: string;
  description?: string;
  submitLabel?: string;
  /** Rendered above the name field — e.g. a warning about items that won't save. */
  notice?: React.ReactNode;
  placeholder?: string;
}

/**
 * The one "name it and go" project-creation flow. Shared by the projects page
 * and the landing page so both behave identically, and by the designer's
 * "Save to my projects" via `afterCreate`.
 */
export default function NewProjectDialog({
  open,
  onClose,
  afterCreate,
  title = "New project",
  description = "Name it anything — you can rename it later.",
  submitLabel = "Create",
  notice,
  placeholder = "e.g. Studio loft — Tirana",
}: NewProjectDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Survives a failed `afterCreate` so retrying reuses the project instead of
  // littering the user's list with orphaned empty rows.
  const createdRef = useRef<api.ProjectDetail | null>(null);

  useEffect(() => {
    if (open) return;
    setName("");
    setError(null);
    setBusy(false);
    createdRef.current = null;
  }, [open]);

  async function handleSubmit(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a name.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      let project = createdRef.current;
      if (project) {
        // Retry after a failed afterCreate — reuse the row, renaming it if the
        // user edited the field before retrying.
        if (project.name !== trimmed) {
          await api.updateProject(project.id, { name: trimmed });
          project = { ...project, name: trimmed };
          createdRef.current = project;
        }
      } else {
        project = await api.createProject(trimmed);
        createdRef.current = project;
      }

      if (afterCreate) await afterCreate(project);

      queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
      setBusy(false);
    }
    // On success we intentionally stay busy — the route change unmounts us.
  }

  const retrying = createdRef.current !== null;

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={handleSubmit}>
            {retrying ? "Retry" : submitLabel}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="space-y-3"
      >
        {notice}
        <Input
          autoFocus
          placeholder={placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        {error && <p className="text-[12px] text-dizajno-danger">{error}</p>}
        {retrying && !error && (
          <p className="text-[12px] text-dizajno-muted">
            The project was created — retrying the scene save.
          </p>
        )}
      </form>
    </Modal>
  );
}
