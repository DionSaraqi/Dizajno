"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  ChevronRight,
  FileText,
  Inbox,
  LayoutGrid,
  ShieldCheck,
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
  TopBar,
} from "@/components/ui";

const POLL_MS = 30_000;

export default function QuotesListPage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?redirect=/quotes");
    }
  }, [status, router]);

  const quotes = useQuery({
    queryKey: ["quotes", "list"],
    queryFn: () => api.listQuotes(),
    enabled: status === "authenticated",
    refetchInterval: POLL_MS,
  });

  if (status !== "authenticated" || !user) {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg">
        <p className="text-sm text-dizajno-muted">Loading…</p>
      </main>
    );
  }

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

      <div className="max-w-6xl mx-auto px-6">
        <PageHeader
          eyebrow="Inbox"
          title="Your quote requests"
          description="Every project you've requested a quote on. Suppliers reply asynchronously — this page polls every 30 seconds."
        />

        <section className="py-8">
          {quotes.isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <Card key={i} flush>
                  <Skeleton className="aspect-[4/3] rounded-t-xl" />
                  <div className="px-4 py-3.5 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {quotes.error && (
            <ErrorState
              error={quotes.error}
              action="load your quotes"
              onRetry={() => void quotes.refetch()}
            />
          )}

          {quotes.data && quotes.data.length === 0 && (
            <EmptyState
              icon={<Inbox />}
              title="No quotes yet"
              description="Open a project, design a room, then click 'Quote' in the designer header to fan out a request to all the suppliers in the scene."
              action={
                <Link href="/projects">
                  <Button variant="secondary" leftIcon={<LayoutGrid />}>
                    Go to projects
                  </Button>
                </Link>
              }
            />
          )}

          {quotes.data && quotes.data.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {quotes.data.map((quote) => (
                <li key={quote.id} className="group">
                  <Link href={`/quotes/${quote.id}`} className="block">
                    <Card
                      flush
                      className="overflow-hidden transition-shadow hover:shadow-card"
                    >
                      <div className="relative aspect-[4/3] bg-dizajno-elevated border-b border-dizajno-border overflow-hidden">
                        {quote.projectThumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={quote.projectThumbnailUrl}
                            alt={quote.projectName}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-dizajno-muted-subtle">
                            <FileText
                              size={24}
                              className="mb-2 opacity-60"
                              strokeWidth={1.4}
                            />
                            <span className="text-[10.5px] font-medium uppercase tracking-label">
                              No preview
                            </span>
                          </div>
                        )}
                        <div className="absolute top-2.5 right-2.5">
                          <StatusBadge status={quote.status} />
                        </div>
                      </div>
                      <div className="px-4 py-3.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-dizajno-text truncate group-hover:text-dizajno-accent transition-colors">
                            {quote.projectName}
                          </p>
                          <p className="mt-0.5 text-[12px] text-dizajno-muted">
                            <span className="font-medium text-dizajno-text-subtle tabular-nums">
                              {quote.respondedCount}/{quote.supplierCount}
                            </span>{" "}
                            replied
                            {quote.declinedCount > 0 && (
                              <>
                                <span className="mx-1.5 text-dizajno-muted-subtle">
                                  ·
                                </span>
                                {quote.declinedCount} declined
                              </>
                            )}
                            <span className="mx-1.5 text-dizajno-muted-subtle">
                              ·
                            </span>
                            {new Date(quote.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-dizajno-muted-subtle group-hover:text-dizajno-text group-hover:translate-x-0.5 transition-all shrink-0"
                        />
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
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
