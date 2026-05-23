"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";

export default function AuditLogPage() {
  const [filters, setFilters] = useState<api.AuditLogFilters>({ page: 1, pageSize: 50 });
  const [draftAction, setDraftAction] = useState("");
  const [draftEntityType, setDraftEntityType] = useState("");

  const page = useQuery({
    queryKey: ["admin", "audit-log", filters],
    queryFn: () => api.searchAuditLog(filters),
  });

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({
            ...filters,
            page: 1,
            action: draftAction || undefined,
            entityType: draftEntityType || undefined,
          });
        }}
        className="flex flex-wrap items-end gap-3 mb-6"
      >
        <div className="space-y-1">
          <label className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Action
          </label>
          <input
            value={draftAction}
            onChange={(e) => setDraftAction(e.target.value)}
            placeholder="e.g. supplier.suspend"
            className="rounded border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-sm text-dizajno-text focus:outline-none focus:border-white/30 w-56"
          />
        </div>
        <div className="space-y-1">
          <label className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Entity type
          </label>
          <input
            value={draftEntityType}
            onChange={(e) => setDraftEntityType(e.target.value)}
            placeholder="e.g. Supplier"
            className="rounded border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-sm text-dizajno-text focus:outline-none focus:border-white/30 w-48"
          />
        </div>
        <button
          type="submit"
          className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-amber-300 hover:bg-amber-500/20 transition"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => {
            setDraftAction("");
            setDraftEntityType("");
            setFilters({ page: 1, pageSize: 50 });
          }}
          className="rounded border border-white/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text transition"
        >
          Reset
        </button>
      </form>

      {page.isLoading && <p className="font-mono text-sm text-dizajno-muted">Loading…</p>}
      {page.data && (
        <>
          <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase mb-3">
            {page.data.totalCount} entries
          </p>
          <ul className="space-y-1.5">
            {page.data.entries.map((e) => (
              <li
                key={e.id}
                className="rounded border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-amber-300">{e.action}</span>
                  <span className="text-dizajno-text">
                    {e.entityType} {e.entityId.slice(0, 8)}…
                  </span>
                  <span className="text-dizajno-muted text-[10px] uppercase tracking-widest ml-auto">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-dizajno-muted text-[10px] uppercase tracking-widest mt-1">
                  by {e.actorEmail ?? "system"}
                  {e.ipAddress ? ` · ${e.ipAddress}` : ""}
                </div>
                {e.diff && (
                  <pre className="mt-1.5 max-h-32 overflow-auto rounded bg-black/40 p-2 text-[10px] text-dizajno-text/80 whitespace-pre-wrap break-all">
                    {e.diff}
                  </pre>
                )}
              </li>
            ))}
          </ul>
          <div className="flex justify-between items-center mt-4">
            <button
              type="button"
              disabled={page.data.page <= 1}
              onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) - 1 })}
              className="rounded border border-white/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text transition disabled:opacity-30"
            >
              Prev
            </button>
            <span className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
              Page {page.data.page}
            </span>
            <button
              type="button"
              disabled={page.data.page * page.data.pageSize >= page.data.totalCount}
              onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}
              className="rounded border border-white/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text transition disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </>
      )}
    </>
  );
}
