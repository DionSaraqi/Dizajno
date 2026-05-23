"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Paperclip, X, Check } from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { ConfirmDialog } from "@/components/ui";

const POLL_MS = 30_000;

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const quoteId = params?.id ?? "";
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?redirect=/quotes/${quoteId}`);
    }
  }, [status, quoteId, router]);

  const quote = useQuery({
    queryKey: ["quotes", quoteId],
    queryFn: () => api.getQuote(quoteId),
    enabled: status === "authenticated" && Boolean(quoteId),
    refetchInterval: POLL_MS,
  });

  // Broad key invalidation so both the detail (["quotes", quoteId]) and the
  // /quotes list cache (["quotes", "list"]) refresh after a state change.
  const cancelMutation = useMutation({
    mutationFn: () => api.cancelQuote(quoteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setCancelOpen(false);
    },
    onError: (err) =>
      setActionError(err instanceof Error ? err.message : "Failed to cancel."),
  });

  const closeMutation = useMutation({
    mutationFn: () => api.closeQuote(quoteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setCloseOpen(false);
    },
    onError: (err) =>
      setActionError(err instanceof Error ? err.message : "Failed to close."),
  });

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg">
        <p className="font-mono text-sm text-dizajno-muted">Loading…</p>
      </main>
    );
  }

  const data = quote.data;
  const isOpen = data?.status === "Open";

  return (
    <main className="min-h-screen w-screen bg-dizajno-bg blueprint-grid">
      <header className="flex items-center gap-4 px-8 py-5 border-b border-white/10 backdrop-blur">
        <Link
          href="/quotes"
          className="text-dizajno-muted hover:text-dizajno-text transition"
          aria-label="Back to quotes"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-mono text-lg tracking-[0.2em] text-dizajno-text truncate">
            {data?.projectName ?? "Quote"}
          </h1>
          <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            {data ? `Status: ${data.status} · ${new Date(data.createdAt).toLocaleDateString()}` : "Loading…"}
          </p>
        </div>
        {isOpen && (
          <div className="flex gap-2">
            <button
              onClick={() => setCancelOpen(true)}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-1.5 rounded border border-white/10 hover:bg-white/5 disabled:opacity-50 px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase text-dizajno-muted hover:text-red-400 transition"
            >
              <X size={12} /> Cancel
            </button>
            <button
              onClick={() => setCloseOpen(true)}
              disabled={closeMutation.isPending}
              className="flex items-center gap-1.5 rounded border border-white/10 hover:bg-white/5 disabled:opacity-50 px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase text-dizajno-muted hover:text-emerald-400 transition"
            >
              <Check size={12} /> Close
            </button>
          </div>
        )}
      </header>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel quote"
        description="Suppliers with pending requests will be marked Expired and can no longer respond. Existing responses stay visible to you."
        confirmLabel="Cancel quote"
        cancelLabel="Keep open"
        confirmTone="danger"
        busy={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate()}
        onCancel={() => setCancelOpen(false)}
      />
      <ConfirmDialog
        open={closeOpen}
        title="Close quote"
        description="Marks the quote as Closed. Responses already received remain in your inbox; no further responses can be sent."
        confirmLabel="Close quote"
        busy={closeMutation.isPending}
        onConfirm={() => closeMutation.mutate()}
        onCancel={() => setCloseOpen(false)}
      />

      <section className="max-w-4xl mx-auto px-8 py-10 space-y-8">
        {quote.isLoading && (
          <p className="font-mono text-sm text-dizajno-muted">Loading…</p>
        )}
        {quote.error && (
          <p className="font-mono text-sm text-red-400 break-words">
            {(quote.error as Error).message}
          </p>
        )}
        {actionError && (
          <p className="font-mono text-[11px] text-red-400">{actionError}</p>
        )}

        {data?.message && (
          <div className="rounded border border-white/10 bg-black/30 p-4">
            <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted mb-1.5">
              Your message
            </p>
            <p className="font-mono text-sm text-dizajno-text whitespace-pre-wrap">
              {data.message}
            </p>
          </div>
        )}

        {data?.requests.map((req) => (
          <RequestSection key={req.id} request={req} />
        ))}

        {data && data.requests.length === 0 && (
          <p className="font-mono text-sm text-dizajno-muted">
            No suppliers in this quote.
          </p>
        )}
      </section>
    </main>
  );
}

function RequestSection({ request }: { request: api.QuoteRequestDto }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <div>
          <p className="font-mono text-sm text-dizajno-text">{request.supplierName}</p>
          <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted mt-0.5">
            {request.lines.length} {request.lines.length === 1 ? "line" : "lines"} · {request.status}
          </p>
        </div>
        {request.response && (
          <p className="font-mono text-sm text-dizajno-text">
            {formatPrice(request.response.totalPrice, request.response.currency)}
          </p>
        )}
      </header>

      <div className="divide-y divide-white/5">
        {request.lines.map((line) => (
          <LineRow key={line.id} line={line} />
        ))}
      </div>

      {request.response && (
        <div className="border-t border-white/10 px-5 py-4 bg-black/20 space-y-2">
          <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted">
            Supplier reply · {new Date(request.response.respondedAt).toLocaleString()}
          </p>
          {request.response.body && (
            <p className="font-mono text-sm text-dizajno-text whitespace-pre-wrap">
              {request.response.body}
            </p>
          )}
          {request.response.attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2 pt-1">
              {request.response.attachments.map((att) => (
                <li key={att.id}>
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded border border-white/10 hover:bg-white/5 px-2.5 py-1 font-mono text-[11px] text-dizajno-muted hover:text-dizajno-text transition"
                  >
                    <Paperclip size={11} />
                    {att.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"} · {formatBytes(att.sizeBytes)}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function LineRow({ line }: { line: api.QuoteLine }) {
  const productName = line.variantSnapshot?.productName ?? "Item";
  const stockStr = `${line.variantSnapshot.stockWidth} × ${line.variantSnapshot.stockDepth} × ${line.variantSnapshot.stockHeight} m`;
  const scaledStr =
    line.scaledWidth != null && line.scaledDepth != null && line.scaledHeight != null
      ? `${line.scaledWidth} × ${line.scaledDepth} × ${line.scaledHeight} m`
      : null;
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-mono text-sm text-dizajno-text truncate">{productName}</p>
        <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase mt-0.5">
          {line.isCustomSize && scaledStr ? `${scaledStr} (custom)` : stockStr}
        </p>
      </div>
      <p className="font-mono text-xs text-dizajno-muted whitespace-nowrap">
        {line.suggestedPrice == null
          ? "—"
          : `~${formatPrice(line.suggestedPrice, line.currency)}`}
      </p>
    </div>
  );
}

function formatPrice(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toFixed(0)} ${currency}`;
  }
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} kB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
