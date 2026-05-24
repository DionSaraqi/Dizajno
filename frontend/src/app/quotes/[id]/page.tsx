"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Briefcase,
  Check,
  Inbox,
  Paperclip,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Spinner,
  TopBar,
} from "@/components/ui";

const POLL_MS = 30_000;

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const quoteId = params?.id ?? "";
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
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
  const isOpen = data?.status === "Open";

  return (
    <div className="min-h-screen w-screen bg-dizajno-bg">
      <TopBar
        links={[
          { label: "Projects", href: "/projects" },
          { label: "Quotes", href: "/quotes", active: true },
        ]}
        actions={
          <>
            {(user.supplierMemberships?.length ?? 0) > 0 && (
              <Link href="/supplier">
                <Button variant="secondary" size="sm" leftIcon={<Briefcase />}>
                  Supplier portal
                </Button>
              </Link>
            )}
            {user.roles.includes("Admin") && (
              <Link href="/admin">
                <Button variant="secondary" size="sm" leftIcon={<ShieldCheck />}>
                  Admin
                </Button>
              </Link>
            )}
          </>
        }
        user={{ displayName: user.displayName, email: user.email }}
        onSignOut={async () => {
          await logout();
          router.push("/");
        }}
      />

      <div className="max-w-5xl mx-auto px-6">
        <PageHeader
          breadcrumbs={[
            { label: "Quotes", href: "/quotes" },
            { label: data?.projectName ?? "Quote" },
          ]}
          title={data?.projectName ?? "Quote"}
          description={
            data ? (
              <span className="inline-flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge status={data.status} />
                <span className="text-[12.5px] text-dizajno-muted">
                  Requested {new Date(data.createdAt).toLocaleDateString()}
                </span>
              </span>
            ) : (
              "Loading…"
            )
          }
          actions={
            isOpen ? (
              <>
                <Button
                  variant="danger-outline"
                  leftIcon={<X />}
                  loading={cancelMutation.isPending}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  leftIcon={<Check />}
                  loading={closeMutation.isPending}
                  onClick={() => setCloseOpen(true)}
                >
                  Close
                </Button>
              </>
            ) : null
          }
        />

        <ConfirmDialog
          open={cancelOpen}
          title="Cancel quote?"
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
          title="Close quote?"
          description="Marks the quote as Closed. Responses already received remain in your inbox; no further responses can be sent."
          confirmLabel="Close quote"
          busy={closeMutation.isPending}
          onConfirm={() => closeMutation.mutate()}
          onCancel={() => setCloseOpen(false)}
        />

        <section className="py-8 space-y-6 max-w-4xl">
          {quote.isLoading && (
            <div className="flex items-center gap-2 text-dizajno-muted text-sm">
              <Spinner /> Loading quote…
            </div>
          )}
          {quote.error && (
            <div className="rounded-xl border border-dizajno-danger/30 bg-dizajno-danger-soft px-4 py-3 text-[13px] text-dizajno-danger">
              {(quote.error as Error).message}
            </div>
          )}
          {actionError && (
            <div className="rounded-lg border border-dizajno-danger/30 bg-dizajno-danger-soft px-3 py-2 text-[13px] text-dizajno-danger flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {actionError}
            </div>
          )}

          {data?.message && (
            <Card>
              <header className="px-5 pt-4 pb-3 border-b border-dizajno-border">
                <h3 className="text-[12.5px] font-semibold uppercase tracking-label text-dizajno-muted">
                  Your message
                </h3>
              </header>
              <div className="px-5 py-4">
                <p className="text-[13.5px] text-dizajno-text whitespace-pre-wrap leading-relaxed">
                  {data.message}
                </p>
              </div>
            </Card>
          )}

          {data?.requests.map((req) => (
            <RequestSection key={req.id} request={req} />
          ))}

          {data && data.requests.length === 0 && (
            <EmptyState
              icon={<Inbox />}
              title="No suppliers in this quote"
              description="This shouldn't normally happen — every quote fans out to at least one supplier."
            />
          )}
        </section>
      </div>
    </div>
  );
}

function RequestSection({ request }: { request: api.QuoteRequestDto }) {
  return (
    <Card flush>
      <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-dizajno-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-dizajno-elevated text-dizajno-muted flex items-center justify-center shrink-0">
            <Store size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-dizajno-text truncate">
              {request.supplierName}
            </p>
            <p className="mt-0.5 text-[12px] text-dizajno-muted">
              {request.lines.length}{" "}
              {request.lines.length === 1 ? "line" : "lines"}
              <span className="mx-1.5 text-dizajno-muted-subtle">·</span>
              <SupplierStatusBadge status={request.status} />
            </p>
          </div>
        </div>
        {request.response && (
          <div className="text-right shrink-0">
            <p className="text-[11px] uppercase tracking-label text-dizajno-muted">
              Quoted
            </p>
            <p className="text-[16px] font-semibold text-dizajno-text tabular-nums">
              {formatPrice(request.response.totalPrice, request.response.currency)}
            </p>
          </div>
        )}
      </header>

      <div className="divide-y divide-dizajno-border-subtle">
        {request.lines.map((line) => (
          <LineRow key={line.id} line={line} />
        ))}
      </div>

      {request.response && (
        <div className="border-t border-dizajno-border px-5 py-4 bg-dizajno-bg/40 rounded-b-xl space-y-3">
          <p className="text-[11px] uppercase tracking-label text-dizajno-muted">
            Supplier reply ·{" "}
            <span className="normal-case tracking-normal text-dizajno-muted">
              {new Date(request.response.respondedAt).toLocaleString()}
            </span>
          </p>
          {request.response.body && (
            <p className="text-[13.5px] text-dizajno-text whitespace-pre-wrap leading-relaxed">
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dizajno-border bg-dizajno-surface hover:border-dizajno-accent/40 hover:text-dizajno-accent px-2.5 py-1.5 text-[12px] text-dizajno-text-subtle font-medium transition-colors"
                  >
                    <Paperclip size={12} />
                    {att.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"}
                    <span className="text-dizajno-muted">
                      {formatBytes(att.sizeBytes)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function LineRow({ line }: { line: api.QuoteLine }) {
  const productName = line.variantSnapshot?.productName ?? "Item";
  const stockStr = `${line.variantSnapshot.stockWidth} × ${line.variantSnapshot.stockDepth} × ${line.variantSnapshot.stockHeight} m`;
  const scaledStr =
    line.scaledWidth != null &&
    line.scaledDepth != null &&
    line.scaledHeight != null
      ? `${line.scaledWidth} × ${line.scaledDepth} × ${line.scaledHeight} m`
      : null;
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-dizajno-text truncate">
          {productName}
        </p>
        <p className="mt-0.5 text-[12px] text-dizajno-muted font-mono">
          {line.isCustomSize && scaledStr ? `${scaledStr} (custom)` : stockStr}
        </p>
      </div>
      <p className="text-[12.5px] text-dizajno-muted tabular-nums whitespace-nowrap shrink-0">
        {line.suggestedPrice == null
          ? "—"
          : `~${formatPrice(line.suggestedPrice, line.currency)}`}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: api.QuoteStatus }) {
  const map = {
    Open: { tone: "success" as const, label: "Open" },
    Closed: { tone: "neutral" as const, label: "Closed" },
    Cancelled: { tone: "danger" as const, label: "Cancelled" },
  };
  const entry = map[status];
  return (
    <Badge tone={entry.tone} size="sm" dot>
      {entry.label}
    </Badge>
  );
}

function SupplierStatusBadge({ status }: { status: api.QuoteRequestStatus }) {
  const map = {
    Pending: { tone: "warning" as const, label: "Awaiting reply" },
    Responded: { tone: "success" as const, label: "Responded" },
    Declined: { tone: "danger" as const, label: "Declined" },
    Expired: { tone: "neutral" as const, label: "Expired" },
  };
  const entry = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11.5px] font-medium ${
        entry.tone === "success"
          ? "text-dizajno-success"
          : entry.tone === "warning"
            ? "text-dizajno-warning"
            : entry.tone === "danger"
              ? "text-dizajno-danger"
              : "text-dizajno-muted"
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          entry.tone === "success"
            ? "bg-dizajno-success"
            : entry.tone === "warning"
              ? "bg-dizajno-warning"
              : entry.tone === "danger"
                ? "bg-dizajno-danger"
                : "bg-dizajno-muted"
        }`}
      />
      {entry.label}
    </span>
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

