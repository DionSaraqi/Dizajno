"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RotateCcw, ScrollText, Search } from "lucide-react";
import * as api from "@/lib/api";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  Skeleton,
} from "@/components/ui";

export default function AuditLogPage() {
  const [filters, setFilters] = useState<api.AuditLogFilters>({
    page: 1,
    pageSize: 50,
  });
  const [draftAction, setDraftAction] = useState("");
  const [draftEntityType, setDraftEntityType] = useState("");

  const page = useQuery({
    queryKey: ["admin", "audit-log", filters],
    queryFn: () => api.searchAuditLog(filters),
  });

  function applyFilters() {
    setFilters({
      ...filters,
      page: 1,
      action: draftAction || undefined,
      entityType: draftEntityType || undefined,
    });
  }

  function reset() {
    setDraftAction("");
    setDraftEntityType("");
    setFilters({ page: 1, pageSize: 50 });
  }

  return (
    <>
      <PageHeader
        eyebrow="Trail"
        title="Audit log"
        description="Every sensitive action — supplier lifecycle, invites, moderation — recorded with actor, IP, and a JSON diff."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
        className="py-6 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end"
      >
        <FormField label="Action">
          <Input
            value={draftAction}
            onChange={(e) => setDraftAction(e.target.value)}
            placeholder="e.g. supplier.suspend"
            className="font-mono"
          />
        </FormField>
        <FormField label="Entity type">
          <Input
            value={draftEntityType}
            onChange={(e) => setDraftEntityType(e.target.value)}
            placeholder="e.g. Supplier"
          />
        </FormField>
        <Button type="submit" variant="primary" leftIcon={<Search />}>
          Search
        </Button>
        <Button
          type="button"
          variant="ghost"
          leftIcon={<RotateCcw />}
          onClick={reset}
        >
          Reset
        </Button>
      </form>

      {page.error && (
        <ErrorState
          error={page.error}
          action="load the audit log"
          onRetry={() => void page.refetch()}
        />
      )}

      {page.isLoading && (
        <Card flush>
          <ul className="divide-y divide-dizajno-border">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="px-5 py-4 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {page.data && page.data.entries.length === 0 && (
        <EmptyState
          icon={<ScrollText />}
          title="No entries match"
          description="Try a broader search — drop the entity type or use a partial action like 'supplier.'."
        />
      )}

      {page.data && page.data.entries.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12.5px] text-dizajno-muted">
              <span className="font-medium text-dizajno-text-subtle tabular-nums">
                {page.data.totalCount}
              </span>{" "}
              entries
            </p>
          </div>

          <Card flush>
            <ul className="divide-y divide-dizajno-border">
              {page.data.entries.map((e) => (
                <li key={e.id} className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <Avatar
                      size={28}
                      fallback={(e.actorEmail ?? "system").slice(0, 2)}
                      alt={e.actorEmail ?? "system"}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <Badge tone="accent" size="sm" mono>
                          {e.action}
                        </Badge>
                        <span className="text-[12.5px] text-dizajno-text-subtle">
                          {e.entityType}
                        </span>
                        <span className="text-[11.5px] text-dizajno-muted-subtle font-mono">
                          {e.entityId.slice(0, 8)}…
                        </span>
                        <span className="ml-auto text-[11.5px] text-dizajno-muted tabular-nums">
                          {new Date(e.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-dizajno-muted">
                        by{" "}
                        <span className="text-dizajno-text-subtle font-medium">
                          {e.actorEmail ?? "system"}
                        </span>
                        {e.ipAddress && (
                          <>
                            <span className="mx-1.5 text-dizajno-muted-subtle">
                              ·
                            </span>
                            <span className="font-mono">{e.ipAddress}</span>
                          </>
                        )}
                      </p>
                      {e.diff && (
                        <pre className="mt-2 max-h-32 overflow-auto rounded-md bg-dizajno-elevated border border-dizajno-border-subtle p-2.5 text-[11px] text-dizajno-text-subtle font-mono whitespace-pre-wrap break-all">
                          {e.diff}
                        </pre>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <div className="mt-4 flex justify-between items-center">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ChevronLeft />}
              disabled={page.data.page <= 1}
              onClick={() =>
                setFilters({ ...filters, page: (filters.page ?? 1) - 1 })
              }
            >
              Previous
            </Button>
            <span className="text-[12.5px] text-dizajno-muted tabular-nums">
              Page {page.data.page} of{" "}
              {Math.max(
                1,
                Math.ceil(page.data.totalCount / page.data.pageSize),
              )}
            </span>
            <Button
              variant="secondary"
              size="sm"
              rightIcon={<ChevronRight />}
              disabled={
                page.data.page * page.data.pageSize >= page.data.totalCount
              }
              onClick={() =>
                setFilters({ ...filters, page: (filters.page ?? 1) + 1 })
              }
            >
              Next
            </Button>
          </div>
        </>
      )}
    </>
  );
}
