"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Paperclip, Send, X } from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { ConfirmDialog } from "@/components/ui";

const POLL_MS = 30_000;

export default function SupplierQuoteDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params?.id ?? "";
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?redirect=/supplier/quotes/${requestId}`);
    }
  }, [status, requestId, router]);

  const quote = useQuery({
    queryKey: ["supplier", "quotes", requestId],
    queryFn: () => api.getSupplierQuote(requestId),
    enabled: status === "authenticated" && Boolean(requestId),
    refetchInterval: POLL_MS,
  });

  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<api.AssetSummary[]>([]);
  const [respondError, setRespondError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  // Hydrate form from existing response so suppliers can edit-in-place.
  useEffect(() => {
    if (!quote.data?.response) return;
    setPrice(quote.data.response.totalPrice.toString());
    setCurrency(quote.data.response.currency);
    setBody(quote.data.response.body ?? "");
    setAttachments(
      quote.data.response.attachments.map((a) => ({
        id: a.assetId,
        kind: "Doc",
        url: a.url,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        checksumSha256: null,
        productId: null,
        variantId: null,
        ownerSupplierId: quote.data!.supplierId,
        sortOrder: a.sortOrder,
        createdAt: new Date().toISOString(),
      }))
    );
  }, [quote.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Broad ["supplier"] invalidation refreshes both the detail and inbox lists.
  const respond = useMutation({
    mutationFn: () =>
      api.respondToSupplierQuote(requestId, {
        totalPrice: parseFloat(price || "0"),
        currency: currency.trim().toUpperCase() || "EUR",
        body: body.trim() || null,
        attachmentAssetIds: attachments.map((a) => a.id),
      }),
    onSuccess: () => {
      setRespondError(null);
      queryClient.invalidateQueries({ queryKey: ["supplier"] });
    },
    onError: (err) =>
      setRespondError(err instanceof Error ? err.message : "Failed to send response."),
  });

  const decline = useMutation({
    mutationFn: (reason: string) => api.declineSupplierQuote(requestId, reason || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier"] });
      setDeclineOpen(false);
      setDeclineReason("");
    },
  });

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !quote.data) return;
    setUploading(true);
    setRespondError(null);
    try {
      const kind: "Image" | "Doc" | "Attachment" =
        file.type === "application/pdf"
          ? "Doc"
          : file.type.startsWith("image/")
            ? "Image"
            : "Attachment";
      const presigned = await api.presignSupplierAsset({
        supplierId: quote.data.supplierId,
        kind,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        originalFileName: file.name,
      });
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(presigned.requiredHeaders)) headers[k] = v;
      const put = await fetch(presigned.uploadUrl, { method: "PUT", headers, body: file });
      if (!put.ok) throw new Error(`Upload failed: ${put.status}`);
      const asset = await api.createSupplierAsset({
        supplierId: quote.data.supplierId,
        key: presigned.key,
        kind,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      setAttachments((prev) => [...prev, asset]);
    } catch (err) {
      setRespondError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg">
        <p className="font-mono text-sm text-dizajno-muted">Loading…</p>
      </main>
    );
  }

  const data = quote.data;
  const locked = data?.quoteStatus === "Closed" || data?.quoteStatus === "Cancelled";

  return (
    <main className="min-h-screen w-screen bg-dizajno-bg blueprint-grid">
      <header className="flex items-center gap-4 px-8 py-5 border-b border-white/10 backdrop-blur">
        <Link
          href="/supplier/quotes"
          className="text-dizajno-muted hover:text-dizajno-text transition"
          aria-label="Back to inbox"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-mono text-lg tracking-[0.2em] text-dizajno-text truncate">
            {data?.projectName ?? "Loading…"}
          </h1>
          <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            {data
              ? `From ${data.requesterDisplayName} · ${data.status} · ${new Date(data.createdAt).toLocaleString()}`
              : "Loading…"}
          </p>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-8 py-10 space-y-8">
        {quote.isLoading && (
          <p className="font-mono text-sm text-dizajno-muted">Loading…</p>
        )}
        {quote.error && (
          <p className="font-mono text-sm text-red-400 break-words">
            {(quote.error as Error).message}
          </p>
        )}

        {data?.message && (
          <div className="rounded border border-white/10 bg-black/30 p-4">
            <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted mb-1.5">
              Customer message
            </p>
            <p className="font-mono text-sm text-dizajno-text whitespace-pre-wrap">
              {data.message}
            </p>
          </div>
        )}

        {data && (
          <div className="rounded border border-white/10 bg-black/30">
            <header className="px-5 py-3 border-b border-white/10 font-mono text-[10px] tracking-widest uppercase text-dizajno-muted">
              Lines
            </header>
            <ul className="divide-y divide-white/5">
              {data.lines.map((line) => (
                <li key={line.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-dizajno-text truncate">
                      {line.variantSnapshot.productName}
                    </p>
                    <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted mt-0.5">
                      {line.isCustomSize && line.scaledWidth != null
                        ? `${line.scaledWidth} × ${line.scaledDepth} × ${line.scaledHeight} m (custom)`
                        : `${line.variantSnapshot.stockWidth} × ${line.variantSnapshot.stockDepth} × ${line.variantSnapshot.stockHeight} m`}
                    </p>
                  </div>
                  <p className="font-mono text-xs text-dizajno-muted whitespace-nowrap">
                    {line.suggestedPrice == null
                      ? "—"
                      : `~${formatPrice(line.suggestedPrice, line.currency)}`}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded border border-white/10 bg-black/30 p-5 space-y-4">
          <header>
            <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted">
              {data?.response ? "Update response" : "Respond"}
            </p>
            {locked && (
              <p className="font-mono text-[11px] text-amber-400/80 mt-1">
                Parent quote is {data?.quoteStatus.toLowerCase()}; responses are locked.
              </p>
            )}
          </header>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="Total price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={locked}
              className="flex-1 rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-dizajno-text focus:border-white/40 focus:outline-none disabled:opacity-50"
            />
            <input
              type="text"
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              disabled={locked}
              className="w-20 rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-dizajno-text focus:border-white/40 focus:outline-none disabled:opacity-50"
            />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={locked}
            rows={4}
            placeholder="Notes for the customer (lead time, alternatives, etc.)"
            className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-dizajno-text focus:border-white/40 focus:outline-none disabled:opacity-50"
          />

          <div className="space-y-2">
            <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted">
              Attachments
            </p>
            <ul className="space-y-1">
              {attachments.map((att) => (
                <li
                  key={att.id}
                  className="flex items-center justify-between gap-2 rounded border border-white/10 bg-black/40 px-3 py-1.5"
                >
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 font-mono text-[11px] text-dizajno-muted hover:text-dizajno-text"
                  >
                    <Paperclip size={11} />
                    {att.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"} ·{" "}
                    {formatBytes(att.sizeBytes)}
                  </a>
                  <button
                    onClick={() => setAttachments((p) => p.filter((a) => a.id !== att.id))}
                    disabled={locked}
                    className="text-dizajno-muted hover:text-red-400 disabled:opacity-50"
                    aria-label="Remove attachment"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="file"
                onChange={handleFileChange}
                disabled={locked || uploading}
                className="hidden"
              />
              <span className="inline-flex items-center gap-1.5 rounded border border-white/10 hover:bg-white/5 px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text transition">
                <Paperclip size={12} />
                {uploading ? "Uploading…" : "Add file"}
              </span>
            </label>
          </div>

          {respondError && (
            <p className="font-mono text-[11px] text-red-400">{respondError}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => respond.mutate()}
              disabled={locked || respond.isPending || !price}
              className="flex-1 flex items-center justify-center gap-2 rounded bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed py-2.5 font-mono text-xs tracking-wider text-dizajno-text transition"
            >
              <Send size={12} />
              {respond.isPending ? "Sending…" : data?.response ? "Update response" : "Send response"}
            </button>
            {data?.status !== "Declined" && (
              <button
                onClick={() => setDeclineOpen(true)}
                disabled={locked || decline.isPending}
                className="rounded border border-white/10 hover:bg-white/5 disabled:opacity-50 px-4 py-2.5 font-mono text-xs tracking-wider text-dizajno-muted hover:text-red-400 transition"
              >
                Decline
              </button>
            )}
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={declineOpen}
        title="Decline request"
        description="The customer sees your reason in their quote inbox. The request status becomes Declined."
        confirmLabel="Decline request"
        confirmTone="danger"
        busy={decline.isPending}
        onConfirm={() => decline.mutate(declineReason)}
        onCancel={() => {
          setDeclineOpen(false);
          setDeclineReason("");
        }}
      >
        <div>
          <label className="block font-mono text-[10px] tracking-widest uppercase text-dizajno-muted mb-2">
            Reason (optional)
          </label>
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={3}
            placeholder="Out of stock, custom size unavailable, lead time too long…"
            className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-dizajno-text focus:border-white/40 focus:outline-none"
          />
        </div>
      </ConfirmDialog>
    </main>
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
