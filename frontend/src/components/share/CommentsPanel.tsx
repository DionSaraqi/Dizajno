"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Lock,
  MapPin,
  MessageSquare,
  Send,
} from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { Badge, Button, Input, Textarea } from "@/components/ui";

interface CommentsPanelProps {
  token: string;
  mode: api.ShareMode;
}

/**
 * Right-rail thread for /share/[token]. Uses the app's own surface palette so
 * the shared view reads as the same product as the rest of the designer.
 */
export function CommentsPanel({ token, mode }: CommentsPanelProps) {
  const queryClient = useQueryClient();
  const isSignedIn = useAuthStore((s) => s.status === "authenticated");
  const currentUser = useAuthStore((s) => s.user);

  const [body, setBody] = useState("");
  const [guestName, setGuestName] = useState("");
  const [postError, setPostError] = useState<string | null>(null);

  const comments = useQuery({
    queryKey: ["share", token, "comments"],
    queryFn: () => api.listSharedComments(token),
    refetchInterval: mode === "Comment" ? 15_000 : false,
  });

  const postMutation = useMutation({
    mutationFn: (input: api.PostCommentRequest) =>
      api.postSharedComment(token, input),
    onSuccess: () => {
      setBody("");
      setPostError(null);
      queryClient.invalidateQueries({ queryKey: ["share", token, "comments"] });
    },
    onError: (error) => {
      setPostError(error instanceof Error ? error.message : "Failed to post.");
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPostError(null);
    const trimmed = body.trim();
    if (!trimmed) {
      setPostError("Type something first.");
      return;
    }
    if (!isSignedIn && !guestName.trim()) {
      setPostError("Pick a display name.");
      return;
    }
    postMutation.mutate({
      body: trimmed,
      guestName: isSignedIn ? null : guestName.trim(),
    });
  }

  return (
    <aside className="w-80 border-l border-dizajno-border bg-dizajno-surface flex flex-col">
      <header className="px-4 py-3 border-b border-dizajno-border flex items-center gap-2">
        <MessageSquare size={13} className="text-dizajno-muted" />
        <h3 className="text-[13px] font-semibold text-dizajno-text">Comments</h3>
        {comments.data && (
          <span className="ml-auto text-[11px] text-dizajno-muted tabular-nums">
            {comments.data.length}
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 bg-dizajno-bg">
        {comments.isLoading && (
          <p className="text-[12.5px] text-dizajno-muted">Loading…</p>
        )}
        {comments.data && comments.data.length === 0 && (
          <div className="rounded-lg border border-dizajno-border bg-dizajno-surface px-3 py-4 text-center">
            <p className="text-[12.5px] text-dizajno-muted">
              No comments yet.
              {mode === "Comment" && (
                <>
                  <br />
                  Be the first below.
                </>
              )}
            </p>
          </div>
        )}
        {comments.data?.map((c) => (
          <CommentBubble key={c.id} comment={c} />
        ))}
      </div>

      {mode === "Comment" ? (
        <form
          onSubmit={handleSubmit}
          className="border-t border-dizajno-border p-3 space-y-2 bg-dizajno-surface"
        >
          {!isSignedIn && (
            <Input
              size="sm"
              type="text"
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
          )}
          {isSignedIn && currentUser && (
            <p className="text-[11px] text-dizajno-muted">
              Posting as{" "}
              <span className="text-dizajno-text-subtle font-medium">
                {currentUser.displayName || currentUser.email}
              </span>
            </p>
          )}
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a comment…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              className="flex-1 resize-none text-[13px]"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={postMutation.isPending}
              className="self-end w-9 px-0 shrink-0"
              aria-label="Post comment"
            >
              {!postMutation.isPending && <Send size={13} />}
            </Button>
          </div>
          {postError && (
            <div className="flex items-start gap-1.5 text-[11.5px] text-dizajno-danger">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>{postError}</span>
            </div>
          )}
        </form>
      ) : (
        <div className="border-t border-dizajno-border p-3 bg-dizajno-surface flex items-center justify-center gap-1.5 text-[11.5px] text-dizajno-muted">
          <Lock size={11} />
          This share is view-only.
        </div>
      )}
    </aside>
  );
}

function CommentBubble({ comment }: { comment: api.CommentDto }) {
  const author =
    comment.authorDisplayName ?? comment.guestName ?? "Anonymous";
  const isGuest = comment.authorUserId === null;
  return (
    <div className="rounded-lg border border-dizajno-border bg-dizajno-surface px-3 py-2.5 shadow-card-sm">
      <div className="flex items-baseline gap-2">
        <span className="text-[12.5px] font-semibold text-dizajno-text truncate">
          {author}
        </span>
        {isGuest && (
          <Badge tone="warning" size="sm">
            Guest
          </Badge>
        )}
        <span className="ml-auto text-[10.5px] text-dizajno-muted-subtle tabular-nums whitespace-nowrap">
          {formatRelative(comment.createdAt)}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-dizajno-text-subtle whitespace-pre-wrap break-words leading-relaxed">
        {comment.body}
      </p>
      {comment.anchor && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] text-dizajno-muted">
          <MapPin size={10} />
          {anchorLabel(comment.anchor)}
        </p>
      )}
    </div>
  );
}

function anchorLabel(anchor: api.CommentAnchor): string {
  switch (anchor.type) {
    case "item":
      return `Item ${anchor.id.slice(0, 8)}`;
    case "wall":
      return `Wall ${anchor.id.slice(0, 8)}`;
    case "point":
      return `(${anchor.x.toFixed(1)}, ${anchor.z.toFixed(1)})`;
  }
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString();
}
