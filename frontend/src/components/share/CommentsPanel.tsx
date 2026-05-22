"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

interface CommentsPanelProps {
  token: string;
  mode: api.ShareMode;
}

/**
 * Right-rail thread for /share/[token]. View mode → read-only. Comment mode →
 * read + post. Signed-in visitors post under their identity automatically;
 * everyone else picks a display name on their first reply.
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
    mutationFn: (input: api.PostCommentRequest) => api.postSharedComment(token, input),
    onSuccess: () => {
      setBody("");
      setPostError(null);
      queryClient.invalidateQueries({ queryKey: ["share", token, "comments"] });
    },
    onError: (error) => {
      setPostError(error instanceof Error ? error.message : "Failed to post.");
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
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
    <aside className="w-80 border-l border-white/10 bg-black/40 backdrop-blur flex flex-col">
      <header className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <MessageSquare size={14} className="text-dizajno-muted" />
        <h3 className="font-mono text-xs tracking-widest uppercase text-dizajno-text">
          Comments
        </h3>
        {comments.data && (
          <span className="ml-auto font-mono text-[10px] text-dizajno-muted">
            {comments.data.length}
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {comments.isLoading && (
          <p className="font-mono text-xs text-dizajno-muted">Loading…</p>
        )}
        {comments.data && comments.data.length === 0 && (
          <p className="font-mono text-xs text-dizajno-muted">
            No comments yet.{" "}
            {mode === "Comment" && "Be the first to leave one below."}
          </p>
        )}
        {comments.data?.map((c) => (
          <CommentBubble key={c.id} comment={c} />
        ))}
      </div>

      {mode === "Comment" ? (
        <form
          onSubmit={handleSubmit}
          className="border-t border-white/10 p-3 space-y-2 bg-black/30"
        >
          {!isSignedIn && (
            <input
              type="text"
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full rounded border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-dizajno-text focus:border-white/40 focus:outline-none"
            />
          )}
          {isSignedIn && currentUser && (
            <p className="font-mono text-[10px] text-dizajno-muted">
              Posting as {currentUser.displayName || currentUser.email}
            </p>
          )}
          <div className="flex gap-2">
            <textarea
              placeholder="Add a comment…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              className="flex-1 rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-dizajno-text resize-none focus:border-white/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={postMutation.isPending}
              className="rounded bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-50 px-3 self-end py-2 transition"
              aria-label="Post comment"
            >
              <Send size={14} className="text-dizajno-text" />
            </button>
          </div>
          {postError && (
            <p className="font-mono text-[11px] text-red-400 break-words">{postError}</p>
          )}
        </form>
      ) : (
        <div className="border-t border-white/10 p-3 bg-black/30">
          <p className="font-mono text-[11px] text-dizajno-muted text-center">
            This share is view-only.
          </p>
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
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs text-dizajno-text font-medium">
          {author}
        </span>
        {isGuest && (
          <span className="font-mono text-[9px] tracking-widest uppercase text-dizajno-muted/70">
            guest
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-dizajno-muted/70">
          {new Date(comment.createdAt).toLocaleString()}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-dizajno-text whitespace-pre-wrap break-words">
        {comment.body}
      </p>
      {comment.anchor && (
        <p className="mt-1 font-mono text-[10px] text-dizajno-muted/70">
          {anchorLabel(comment.anchor)}
        </p>
      )}
    </div>
  );
}

function anchorLabel(anchor: api.CommentAnchor): string {
  switch (anchor.type) {
    case "item":
      return `📌 pinned to item ${anchor.id.slice(0, 8)}`;
    case "wall":
      return `📌 pinned to wall ${anchor.id.slice(0, 8)}`;
    case "point":
      return `📌 pinned at (${anchor.x.toFixed(1)}, ${anchor.z.toFixed(1)})`;
  }
}
