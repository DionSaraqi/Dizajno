"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Lock,
  Paperclip,
  Send,
  Store,
  X,
} from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  ApiErrorAlert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  FormField,
  IconButton,
  Input,
  PageHeader,
  Spinner,
  Textarea,
  TopBar,
} from "@/components/ui";

const POLL_MS = 30_000;

export default function SupplierQuoteDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params?.id ?? "";
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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
  const [respondError, setRespondError] = useState<unknown>(null);
  const [uploading, setUploading] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

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
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.data?.id]);

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
    // Rendered inline beside the form, so the global toast net stands down.
    meta: { errorHandled: true },
    onError: setRespondError,
  });

  const decline = useMutation({
    mutationFn: (reason: string) =>
      api.declineSupplierQuote(requestId, reason || null),
    meta: { errorHandled: true },
    onError: setRespondError,
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
      for (const [k, v] of Object.entries(presigned.requiredHeaders))
        headers[k] = v;
      const put = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers,
        body: file,
      });
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
      setRespondError(err);
    } finally {
      setUploading(false);
    }
  }

  if (status !== "authenticated" || !user) {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg">
        <div className="flex items-center gap-2 text-dizajno-muted text-sm">
          <Spinner /> Loading…
        </div>
      </main>
    );
  }

  const data = quote.data;
  const locked = data?.quoteStatus === "Closed" || data?.quoteStatus === "Cancelled";

  return (
    <div className="min-h-screen w-screen bg-dizajno-bg">
      <TopBar
        contextChip={
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-dizajno-accent-soft text-dizajno-accent flex items-center justify-center shrink-0">
              <Store size={13} />
            </div>
            <Link
              href="/supplier"
              className="text-[13px] font-medium text-dizajno-text truncate hover:text-dizajno-accent transition-colors"
            >
              Supplier portal
            </Link>
          </div>
        }
        user={{ displayName: user.displayName, email: user.email }}
        onSignOut={async () => {
          await logout();
          router.push("/");
        }}
        userMenu={
          <Link
            href="/projects"
            className="block w-full px-4 py-1.5 text-[13px] text-dizajno-text-subtle hover:bg-dizajno-elevated hover:text-dizajno-text transition-colors"
          >
            Back to projects
          </Link>
        }
      />

      <div className="max-w-4xl mx-auto px-6">
        <PageHeader
          breadcrumbs={[
            { label: "Quote inbox", href: "/supplier/quotes" },
            { label: data?.projectName ?? "Request" },
          ]}
          title={data?.projectName ?? "Quote request"}
          description={
            data ? (
              <span className="inline-flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[12.5px] text-dizajno-muted">
                  From{" "}
                  <span className="text-dizajno-text-subtle font-medium">
                    {data.requesterDisplayName}
                  </span>
                </span>
                <span className="text-dizajno-muted-subtle">·</span>
                <RequestStatusBadge
                  status={data.status}
                  hasResponse={data.response != null}
                />
                <span className="text-dizajno-muted-subtle">·</span>
                <span className="text-[12.5px] text-dizajno-muted">
                  {new Date(data.createdAt).toLocaleString()}
                </span>
              </span>
            ) : (
              "Loading…"
            )
          }
        />

        <section className="py-6 space-y-6">
          {quote.isLoading && (
            <div className="flex items-center gap-2 text-dizajno-muted text-sm">
              <Spinner /> Loading request…
            </div>
          )}
          {quote.error && (
            <ErrorState
              error={quote.error}
              action="load this request"
              onRetry={() => void quote.refetch()}
            />
          )}

          {data?.message && (
            <Card>
              <header className="px-5 pt-4 pb-3 border-b border-dizajno-border">
                <h3 className="text-[12.5px] font-semibold uppercase tracking-label text-dizajno-muted">
                  Customer message
                </h3>
              </header>
              <div className="px-5 py-4">
                <p className="text-[13.5px] text-dizajno-text whitespace-pre-wrap leading-relaxed">
                  {data.message}
                </p>
              </div>
            </Card>
          )}

          {data && (
            <Card flush>
              <header className="px-5 pt-4 pb-3 border-b border-dizajno-border">
                <h3 className="text-[14px] font-semibold text-dizajno-text">
                  Lines
                </h3>
                <p className="text-[12.5px] text-dizajno-muted mt-0.5">
                  {data.lines.length} item
                  {data.lines.length === 1 ? "" : "s"} in this request
                </p>
              </header>
              <ul className="divide-y divide-dizajno-border-subtle">
                {data.lines.map((line) => (
                  <li
                    key={line.id}
                    className="px-5 py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-dizajno-text truncate">
                        {line.variantSnapshot.productName}
                      </p>
                      <p className="text-[12px] text-dizajno-muted font-mono mt-0.5">
                        {line.isCustomSize && line.scaledWidth != null
                          ? `${line.scaledWidth} × ${line.scaledDepth} × ${line.scaledHeight} m (custom)`
                          : `${line.variantSnapshot.stockWidth} × ${line.variantSnapshot.stockDepth} × ${line.variantSnapshot.stockHeight} m`}
                      </p>
                    </div>
                    <p className="text-[12.5px] text-dizajno-muted tabular-nums whitespace-nowrap shrink-0">
                      {line.suggestedPrice == null
                        ? "—"
                        : `~${formatPrice(line.suggestedPrice, line.currency)}`}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Response composer */}
          {data && (
            <Card>
              <header className="px-5 pt-4 pb-3 border-b border-dizajno-border">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-[14px] font-semibold text-dizajno-text">
                      {data.response ? "Update response" : "Send response"}
                    </h3>
                    <p className="text-[12.5px] text-dizajno-muted mt-0.5">
                      The customer sees this in their /quotes inbox.
                    </p>
                  </div>
                  {locked && (
                    <Badge tone="warning" dot>
                      <Lock size={11} className="mr-1" />
                      Parent quote {data.quoteStatus.toLowerCase()} — locked
                    </Badge>
                  )}
                </div>
              </header>
              <div className="px-5 py-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-3">
                  <FormField label="Total price" required>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      disabled={locked}
                    />
                  </FormField>
                  <FormField label="Currency">
                    <Input
                      value={currency}
                      maxLength={3}
                      onChange={(e) =>
                        setCurrency(e.target.value.toUpperCase())
                      }
                      disabled={locked}
                      className="font-mono"
                    />
                  </FormField>
                </div>

                <FormField
                  label="Notes for the customer"
                  hint="Lead time, alternatives, anything they should know"
                >
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={locked}
                    rows={4}
                  />
                </FormField>

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-label text-dizajno-muted mb-2">
                    Attachments
                  </p>
                  <ul className="space-y-1.5 mb-2">
                    {attachments.map((att) => (
                      <li
                        key={att.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-dizajno-border bg-dizajno-bg/40 px-3 py-2"
                      >
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-[12.5px] text-dizajno-text-subtle hover:text-dizajno-accent transition-colors min-w-0"
                        >
                          <Paperclip
                            size={13}
                            className="shrink-0 text-dizajno-muted"
                          />
                          <span className="truncate font-medium">
                            {att.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"}
                          </span>
                          <span className="text-dizajno-muted-subtle whitespace-nowrap">
                            {formatBytes(att.sizeBytes)}
                          </span>
                        </a>
                        <IconButton
                          variant="danger"
                          size="sm"
                          onClick={() =>
                            setAttachments((p) =>
                              p.filter((a) => a.id !== att.id),
                            )
                          }
                          disabled={locked}
                        >
                          <X />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                  <label className="inline-flex">
                    <span
                      className={[
                        "inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[13px] font-medium transition-colors cursor-pointer",
                        locked || uploading
                          ? "border-dizajno-border bg-dizajno-elevated text-dizajno-muted cursor-wait"
                          : "border-dizajno-border bg-dizajno-surface hover:bg-dizajno-elevated text-dizajno-text-subtle hover:text-dizajno-text",
                      ].join(" ")}
                    >
                      {uploading ? <Spinner size={13} /> : <Paperclip size={13} />}
                      {uploading ? "Uploading…" : "Add file"}
                      <input
                        type="file"
                        onChange={handleFileChange}
                        disabled={locked || uploading}
                        className="hidden"
                      />
                    </span>
                  </label>
                </div>

                {respondError != null && (
                  <ApiErrorAlert
                    error={respondError}
                    action="send your response"
                    size="sm"
                    onDismiss={() => setRespondError(null)}
                  />
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  {data.status !== "Declined" ? (
                    <Button
                      variant="danger-outline"
                      onClick={() => setDeclineOpen(true)}
                      disabled={locked || decline.isPending}
                    >
                      Decline request
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button
                    variant="primary"
                    leftIcon={<Send />}
                    loading={respond.isPending}
                    disabled={locked || !price}
                    onClick={() => respond.mutate()}
                  >
                    {respond.isPending
                      ? "Sending…"
                      : data.response
                        ? "Update response"
                        : "Send response"}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={declineOpen}
        title="Decline request?"
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
        <FormField label="Reason" hint="Optional — visible to the customer">
          <Textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={3}
            placeholder="Out of stock, custom size unavailable, lead time too long…"
          />
        </FormField>
      </ConfirmDialog>
    </div>
  );
}

function RequestStatusBadge({
  status,
  hasResponse,
}: {
  status: api.QuoteRequestStatus;
  hasResponse: boolean;
}) {
  const label =
    hasResponse && status === "Responded" ? "Replied" : prettyStatus(status);
  const map = {
    Pending: { tone: "warning" as const },
    Responded: { tone: "success" as const },
    Declined: { tone: "danger" as const },
    Expired: { tone: "neutral" as const },
  };
  return (
    <Badge tone={map[status].tone} size="sm" dot>
      {label}
    </Badge>
  );
}

function prettyStatus(status: api.QuoteRequestStatus): string {
  switch (status) {
    case "Pending":
      return "Awaiting reply";
    case "Responded":
      return "Replied";
    case "Declined":
      return "Declined";
    case "Expired":
      return "Expired";
  }
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
