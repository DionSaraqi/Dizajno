"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Eye,
  Link2,
  Mail,
  MessageSquare,
  Trash2,
} from "lucide-react";
import * as api from "@/lib/api";
import type { ShareMode } from "@/lib/api";
import {
  Alert,
  ApiErrorAlert,
  Badge,
  Button,
  IconButton,
  Input,
  Modal,
  Tooltip,
} from "@/components/ui";

interface ShareDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Owner-only modal: create / list / revoke share links, plus email invites.
 * Mounted in the /projects/[id] header.
 */
export function ShareDialog({ projectId, open, onClose }: ShareDialogProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ShareMode>("View");
  const [emailInvite, setEmailInvite] = useState("");
  const [emailError, setEmailError] = useState<unknown>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Set only when the clipboard API is unavailable or denied.
  const [copyFallback, setCopyFallback] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode("View");
      setEmailInvite("");
      setEmailError(null);
      setCopied(null);
      setCopyFallback(null);
    }
  }, [open]);

  const shares = useQuery({
    queryKey: ["shares", projectId],
    queryFn: () => api.listShares(projectId),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (input: api.CreateShareRequest) =>
      api.createShare(projectId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["shares", projectId] }),
  });

  const revokeMutation = useMutation({
    mutationFn: (shareId: string) => api.revokeShare(projectId, shareId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["shares", projectId] }),
  });

  function handleCreateLink() {
    createMutation.mutate({ mode, kind: "Link" });
  }

  function handleCreateInvite() {
    setEmailError(null);
    const email = emailInvite.trim();
    if (!email || !email.includes("@")) {
      setEmailError(new Error("Enter a valid email address."));
      return;
    }
    createMutation.mutate(
      { mode, kind: "Email", invitedEmail: email },
      { onSuccess: () => setEmailInvite("") },
    );
  }

  async function handleCopy(token: string) {
    const url = `${window.location.origin}/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      setTimeout(
        () => setCopied((c) => (c === token ? null : c)),
        1500,
      );
    } catch {
      // Clipboard blocked (insecure origin, or permission denied). Reveal the
      // URL in the dialog so it can be selected by hand rather than opening a
      // native prompt the app can neither style nor make accessible.
      setCopyFallback(url);
    }
  }

  const activeShares = shares.data?.filter((s) => s.revokedAt === null) ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share this project"
      description="Generate a public link, or invite specific people by email. Comment access lets viewers leave threaded feedback in the right rail."
      size="lg"
    >
      <div className="space-y-5">
        {/* Mode toggle */}
        <div>
          <p className="text-[11.5px] font-medium uppercase tracking-label text-dizajno-muted mb-2">
            Access level
          </p>
          <div className="flex gap-2">
            <ModeButton
              active={mode === "View"}
              onClick={() => setMode("View")}
              icon={<Eye size={14} />}
              title="View only"
              description="Read-only view of the scene"
            />
            <ModeButton
              active={mode === "Comment"}
              onClick={() => setMode("Comment")}
              icon={<MessageSquare size={14} />}
              title="Can comment"
              description="View + leave feedback in the right rail"
            />
          </div>
        </div>

        {/* Link share */}
        <div className="space-y-2">
          <p className="text-[11.5px] font-medium uppercase tracking-label text-dizajno-muted">
            Public link
          </p>
          <Button
            variant="secondary"
            fullWidth
            leftIcon={<Link2 />}
            loading={
              createMutation.isPending && createMutation.variables?.kind === "Link"
            }
            onClick={handleCreateLink}
          >
            Generate share link
          </Button>
        </div>

        {/* Email invite */}
        <div className="space-y-2">
          <p className="text-[11.5px] font-medium uppercase tracking-label text-dizajno-muted">
            Or invite by email
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="name@example.com"
              value={emailInvite}
              onChange={(e) => setEmailInvite(e.target.value)}
              leftIcon={<Mail />}
            />
            <Button
              variant="primary"
              loading={
                createMutation.isPending &&
                createMutation.variables?.kind === "Email"
              }
              onClick={handleCreateInvite}
            >
              Invite
            </Button>
          </div>
          {emailError != null ? (
            <ApiErrorAlert
              error={emailError}
              action="create this invite"
              size="sm"
              onDismiss={() => setEmailError(null)}
            />
          ) : (
            (createMutation.error ?? revokeMutation.error) != null && (
              <ApiErrorAlert
                error={createMutation.error ?? revokeMutation.error}
                action="update sharing"
                size="sm"
              />
            )
          )}
        </div>

        {copyFallback && (
          <Alert
            tone="info"
            size="sm"
            title="Copy this link by hand"
            live="status"
            onDismiss={() => setCopyFallback(null)}
          >
            <input
              readOnly
              value={copyFallback}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1 w-full rounded-md border border-dizajno-border bg-dizajno-surface px-2 py-1 font-mono text-[11.5px] text-dizajno-text"
            />
          </Alert>
        )}

        {/* Existing shares */}
        <div className="space-y-2 pt-3 border-t border-dizajno-border">
          <p className="text-[11.5px] font-medium uppercase tracking-label text-dizajno-muted">
            Active shares
          </p>
          {shares.isLoading && (
            <p className="text-[12.5px] text-dizajno-muted">Loading…</p>
          )}
          {!shares.isLoading && activeShares.length === 0 && (
            <p className="text-[12.5px] text-dizajno-muted py-2">
              No active shares. Generate one above.
            </p>
          )}
          <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {activeShares.map((share) => (
              <li
                key={share.id}
                className="flex items-center gap-2 rounded-lg border border-dizajno-border bg-dizajno-bg/40 px-3 py-2.5"
              >
                <div className="w-7 h-7 rounded-md bg-dizajno-elevated text-dizajno-muted flex items-center justify-center shrink-0">
                  {share.token ? <Link2 size={13} /> : <Mail size={13} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] text-dizajno-text truncate font-mono">
                    {share.token
                      ? `${window.location.origin}/share/${share.token}`
                      : share.invitedEmail}
                  </p>
                  <div className="mt-0.5">
                    <Badge
                      tone={share.mode === "View" ? "neutral" : "accent"}
                      size="sm"
                      dot
                    >
                      {share.mode === "View" ? "View only" : "Can comment"}
                    </Badge>
                  </div>
                </div>
                {share.token && (
                  <Tooltip content={copied === share.token ? "Copied" : "Copy"}>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(share.token!)}
                    >
                      {copied === share.token ? <Check /> : <Copy />}
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip content="Revoke">
                  <IconButton
                    variant="danger"
                    size="sm"
                    onClick={() => revokeMutation.mutate(share.id)}
                    disabled={revokeMutation.isPending}
                  >
                    <Trash2 />
                  </IconButton>
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-lg border p-3 text-left transition-all",
        active
          ? "border-dizajno-accent bg-dizajno-accent-soft"
          : "border-dizajno-border bg-dizajno-surface hover:border-dizajno-border-strong hover:bg-dizajno-elevated/60",
      ].join(" ")}
    >
      <div
        className={[
          "flex items-center gap-2 mb-1 text-[13px] font-medium",
          active ? "text-dizajno-accent-ink" : "text-dizajno-text",
        ].join(" ")}
      >
        {icon}
        {title}
      </div>
      <p className="text-[11.5px] text-dizajno-muted leading-snug">
        {description}
      </p>
    </button>
  );
}
