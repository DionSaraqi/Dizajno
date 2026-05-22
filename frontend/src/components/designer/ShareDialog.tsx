"use client";

import { Fragment, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, MessageSquare, Trash2, X } from "lucide-react";
import * as api from "@/lib/api";
import type { ShareMode } from "@/lib/api";

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
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Reset transient UI state every time the dialog opens.
  useEffect(() => {
    if (open) {
      setMode("View");
      setEmailInvite("");
      setEmailError(null);
      setCopied(null);
    }
  }, [open]);

  const shares = useQuery({
    queryKey: ["shares", projectId],
    queryFn: () => api.listShares(projectId),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (input: api.CreateShareRequest) => api.createShare(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shares", projectId] }),
  });

  const revokeMutation = useMutation({
    mutationFn: (shareId: string) => api.revokeShare(projectId, shareId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shares", projectId] }),
  });

  if (!open) return null;

  function handleCreateLink(): void {
    createMutation.mutate({ mode, kind: "Link" });
  }

  function handleCreateInvite(): void {
    setEmailError(null);
    const email = emailInvite.trim();
    if (!email || !email.includes("@")) {
      setEmailError("Enter a valid email address.");
      return;
    }
    createMutation.mutate(
      { mode, kind: "Email", invitedEmail: email },
      { onSuccess: () => setEmailInvite("") }
    );
  }

  async function handleCopy(token: string): Promise<void> {
    const url = `${window.location.origin}/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 1500);
    } catch {
      // Clipboard access denied — fall back to a prompt so the user can copy manually.
      window.prompt("Copy this share URL:", url);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-white/10 bg-dizajno-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h2 className="font-mono text-sm tracking-widest text-dizajno-text">SHARE</h2>
          <button
            onClick={onClose}
            className="text-dizajno-muted hover:text-dizajno-text"
            aria-label="Close share dialog"
          >
            <X size={16} />
          </button>
        </header>

        <div className="p-5 space-y-5">
          {/* Mode toggle */}
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted mb-2">
              Access level
            </p>
            <div className="flex gap-2">
              <ModeButton
                active={mode === "View"}
                onClick={() => setMode("View")}
                icon={<Eye size={14} />}
                label="View only"
              />
              <ModeButton
                active={mode === "Comment"}
                onClick={() => setMode("Comment")}
                icon={<MessageSquare size={14} />}
                label="Can comment"
              />
            </div>
          </div>

          {/* Link share */}
          <div className="space-y-2">
            <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted">
              Public link
            </p>
            <button
              onClick={handleCreateLink}
              disabled={createMutation.isPending}
              className="w-full rounded bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-50 py-2 font-mono text-xs tracking-wider text-dizajno-text transition"
            >
              {createMutation.isPending ? "Creating…" : "Generate share link"}
            </button>
          </div>

          {/* Email invite */}
          <div className="space-y-2">
            <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted">
              Or invite by email
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="name@example.com"
                value={emailInvite}
                onChange={(e) => setEmailInvite(e.target.value)}
                className="flex-1 rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-dizajno-text focus:border-white/40 focus:outline-none"
              />
              <button
                onClick={handleCreateInvite}
                disabled={createMutation.isPending}
                className="rounded bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-50 px-4 py-2 font-mono text-xs tracking-wider text-dizajno-text transition"
              >
                Invite
              </button>
            </div>
            {emailError && (
              <p className="font-mono text-[11px] text-red-400">{emailError}</p>
            )}
          </div>

          {/* Existing shares */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted">
              Active shares
            </p>
            {shares.isLoading && (
              <p className="font-mono text-xs text-dizajno-muted">Loading…</p>
            )}
            {shares.data && shares.data.length === 0 && (
              <p className="font-mono text-xs text-dizajno-muted">
                No shares yet. Generate one above.
              </p>
            )}
            <ul className="space-y-1 max-h-64 overflow-y-auto">
              {shares.data
                ?.filter((s) => s.revokedAt === null)
                .map((share) => (
                  <li
                    key={share.id}
                    className="flex items-center gap-2 rounded border border-white/10 bg-black/30 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-dizajno-text truncate">
                        {share.token
                          ? `${window.location.origin}/share/${share.token}`
                          : share.invitedEmail}
                      </p>
                      <p className="font-mono text-[10px] tracking-widest text-dizajno-muted/70 uppercase mt-0.5">
                        {share.mode === "View" ? "View only" : "Can comment"}
                      </p>
                    </div>
                    {share.token && (
                      <button
                        onClick={() => handleCopy(share.token!)}
                        className="text-dizajno-muted hover:text-dizajno-text p-1.5"
                        aria-label="Copy link"
                      >
                        {copied === share.token ? (
                          <span className="font-mono text-[10px]">COPIED</span>
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => revokeMutation.mutate(share.id)}
                      disabled={revokeMutation.isPending}
                      className="text-dizajno-muted hover:text-red-400 p-1.5"
                      aria-label="Revoke share"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 rounded border py-2 font-mono text-xs tracking-wider transition
        ${
          active
            ? "border-white/40 bg-white/10 text-dizajno-text"
            : "border-white/10 bg-black/30 text-dizajno-muted hover:text-dizajno-text"
        }`}
    >
      {icon}
      <Fragment>{label}</Fragment>
    </button>
  );
}
