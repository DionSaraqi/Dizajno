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

interface CommentsPanelProps {
  token: string;
  mode: api.ShareMode;
}

/**
 * Right-rail thread for /share/[token]. Pinned to the dark canvas — uses a
 * darker palette than the rest of the app so it sits flush with the designer
 * surface.
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
    <aside className="w-80 border-l border-white/[0.07] bg-zinc-950 flex flex-col">
      <header className="px-4 py-3 border-b border-white/[0.07] flex items-center gap-2">
        <MessageSquare size={13} className="text-zinc-400" />
        <h3 className="text-[13px] font-semibold text-zinc-100">Comments</h3>
        {comments.data && (
          <span className="ml-auto text-[11px] text-zinc-400 tabular-nums">
            {comments.data.length}
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {comments.isLoading && (
          <p className="text-[12.5px] text-zinc-500">Loading…</p>
        )}
        {comments.data && comments.data.length === 0 && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-center">
            <p className="text-[12.5px] text-zinc-400">
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
          className="border-t border-white/[0.07] p-3 space-y-2 bg-zinc-950"
        >
          {!isSignedIn && (
            <input
              type="text"
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-zinc-100 placeholder:text-zinc-500 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/10"
            />
          )}
          {isSignedIn && currentUser && (
            <p className="text-[11px] text-zinc-400">
              Posting as{" "}
              <span className="text-zinc-200">
                {currentUser.displayName || currentUser.email}
              </span>
            </p>
          )}
          <div className="flex gap-2">
            <textarea
              placeholder="Add a comment…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              className="flex-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-500 resize-none focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/10"
            />
            <button
              type="submit"
              disabled={postMutation.isPending}
              className="inline-flex items-center justify-center w-9 h-9 self-end rounded-md bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 disabled:bg-white/20 disabled:text-zinc-500 transition-colors"
              aria-label="Post comment"
            >
              <Send size={13} />
            </button>
          </div>
          {postError && (
            <div className="flex items-start gap-1.5 text-[11.5px] text-red-400">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>{postError}</span>
            </div>
          )}
        </form>
      ) : (
        <div className="border-t border-white/[0.07] p-3 bg-zinc-950 flex items-center justify-center gap-1.5 text-[11.5px] text-zinc-500">
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
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[12.5px] font-semibold text-zinc-100 truncate">
          {author}
        </span>
        {isGuest && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-tight text-amber-300/90 bg-amber-300/10 border border-amber-300/20">
            Guest
          </span>
        )}
        <span className="ml-auto text-[10.5px] text-zinc-500 tabular-nums whitespace-nowrap">
          {formatRelative(comment.createdAt)}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-zinc-200 whitespace-pre-wrap break-words leading-relaxed">
        {comment.body}
      </p>
      {comment.anchor && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] text-zinc-400">
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
