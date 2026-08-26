"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  ChevronRight,
  Inbox,
  Store,
} from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Spinner,
  TopBar,
} from "@/components/ui";

const POLL_MS = 30_000;

export default function SupplierQuotesPage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?redirect=/supplier/quotes");
    }
  }, [status, router]);

  const memberships = user?.supplierMemberships ?? [];
  const activeMemberships = memberships.filter((m) => !m.isSuspended);
  const isMember = status === "authenticated" && activeMemberships.length > 0;

  const inbox = useQuery({
    queryKey: ["supplier", "quotes"],
    queryFn: () => api.listSupplierQuotes(),
    enabled: isMember,
    refetchInterval: POLL_MS,
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

  // Empty membership state — keep the chrome consistent with the rest of the
  // supplier portal so the user can still get back to /supplier or /projects.
  if (memberships.length === 0) {
    return (
      <div className="min-h-screen w-screen bg-dizajno-bg">
        <TopBar
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
        <div className="max-w-2xl mx-auto px-6 py-16">
          <EmptyState
            icon={<Briefcase />}
            title="No supplier memberships"
            description="The supplier inbox is only available to people invited to manage a supplier. Ask an admin or supplier owner to send you an invite."
            action={
              <Link href="/projects">
                <Button variant="secondary">Back to projects</Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

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

      <div className="max-w-5xl mx-auto px-6">
        <PageHeader
          eyebrow="Inbox"
          title="Quote requests"
          description={
            <span>
              Across{" "}
              <span className="text-dizajno-text-subtle font-medium">
                {activeMemberships.map((m) => m.supplierName).join(", ")}
              </span>
              . Polls every 30 seconds.
            </span>
          }
        />

        <section className="py-6">
          {inbox.isLoading && (
            <Card flush>
              <ul className="divide-y divide-dizajno-border">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="px-5 py-4 flex items-center gap-4">
                    <Skeleton className="w-9 h-9 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {inbox.error && (
            <ErrorState
              error={inbox.error}
              action="load your quote inbox"
              onRetry={() => void inbox.refetch()}
            />
          )}

          {inbox.data && inbox.data.length === 0 && (
            <EmptyState
              icon={<Inbox />}
              title="Inbox is empty"
              description="Quote requests from customers land here as they come in. Trusted suppliers' products show up in the buyer-facing catalog immediately; otherwise they need admin approval first."
            />
          )}

          {inbox.data && inbox.data.length > 0 && (
            <Card flush>
              <ul className="divide-y divide-dizajno-border">
                {inbox.data.map((req) => (
                  <li key={req.id} className="group">
                    <Link
                      href={`/supplier/quotes/${req.id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-dizajno-bg/40 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-dizajno-elevated text-dizajno-muted flex items-center justify-center shrink-0">
                        <Inbox size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[14px] font-medium text-dizajno-text truncate group-hover:text-dizajno-accent transition-colors">
                            {req.projectName}
                          </p>
                          <RequestStatusBadge
                            status={req.status}
                            hasResponse={req.hasResponse}
                          />
                        </div>
                        <p className="mt-1 text-[12px] text-dizajno-muted truncate">
                          From{" "}
                          <span className="text-dizajno-text-subtle font-medium">
                            {req.requesterDisplayName}
                          </span>
                          <span className="mx-1.5 text-dizajno-muted-subtle">
                            ·
                          </span>
                          <span className="tabular-nums">
                            {req.lineCount}
                          </span>{" "}
                          line{req.lineCount === 1 ? "" : "s"}
                          <span className="mx-1.5 text-dizajno-muted-subtle">
                            ·
                          </span>
                          {formatRelative(req.createdAt)}
                        </p>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-dizajno-muted-subtle group-hover:text-dizajno-text group-hover:translate-x-0.5 transition-all shrink-0"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
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

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}
