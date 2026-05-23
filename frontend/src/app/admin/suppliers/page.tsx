"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, BadgeCheck, Plus, RotateCcw, ShieldCheck, ShieldOff } from "lucide-react";
import * as api from "@/lib/api";

export default function AdminSuppliersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const suppliers = useQuery({
    queryKey: ["admin", "suppliers", { search }],
    queryFn: () => api.listAdminSuppliers({ search: search || undefined }),
  });

  const suspend = useMutation({
    mutationFn: (id: string) => api.suspendSupplier(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "suppliers"] }),
  });
  const restore = useMutation({
    mutationFn: (id: string) => api.restoreSupplier(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "suppliers"] }),
  });
  const trust = useMutation({
    mutationFn: (id: string) => api.trustSupplier(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "suppliers"] }),
  });
  const untrust = useMutation({
    mutationFn: (id: string) => api.untrustSupplier(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "suppliers"] }),
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-6">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or slug"
          className="rounded border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-sm text-dizajno-text placeholder:text-dizajno-muted/40 focus:outline-none focus:border-white/30 w-72"
        />
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-amber-300 hover:bg-amber-500/20 transition"
        >
          <Plus size={12} /> New supplier
        </button>
      </div>

      {suppliers.isLoading && (
        <p className="font-mono text-sm text-dizajno-muted">Loading suppliers…</p>
      )}
      {suppliers.error && (
        <p className="font-mono text-sm text-red-400">
          {(suppliers.error as Error).message}
        </p>
      )}
      {suppliers.data && suppliers.data.length === 0 && (
        <p className="font-mono text-sm text-dizajno-muted">No suppliers match.</p>
      )}

      {suppliers.data && suppliers.data.length > 0 && (
        <ul className="grid grid-cols-1 gap-3">
          {suppliers.data.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-4 rounded border border-white/10 bg-black/30 px-4 py-3 hover:bg-black/40 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/suppliers/${s.id}`}
                    className="font-mono text-sm text-dizajno-text hover:text-amber-300 transition truncate"
                  >
                    {s.name}
                  </Link>
                  {s.isTrusted && (
                    <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] tracking-widest uppercase text-emerald-300">
                      Trusted
                    </span>
                  )}
                  {s.suspendedAt && (
                    <span className="rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 font-mono text-[9px] tracking-widest uppercase text-red-300">
                      Suspended
                    </span>
                  )}
                </div>
                <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase mt-0.5 truncate">
                  /{s.slug} · {s.productCount} products · {s.memberCount} members
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {s.isTrusted ? (
                  <button
                    type="button"
                    onClick={() => untrust.mutate(s.id)}
                    title="Untrust (new products go Pending)"
                    className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-amber-300 hover:border-amber-500/40 transition"
                  >
                    <ShieldOff size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => trust.mutate(s.id)}
                    title="Trust (new products auto-publish)"
                    className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-emerald-300 hover:border-emerald-500/40 transition"
                  >
                    <ShieldCheck size={14} />
                  </button>
                )}
                {s.suspendedAt ? (
                  <button
                    type="button"
                    onClick={() => restore.mutate(s.id)}
                    title="Restore supplier"
                    className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-emerald-300 hover:border-emerald-500/40 transition"
                  >
                    <RotateCcw size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Suspend "${s.name}"? Their products hide from catalog and any pending quote requests auto-expire.`))
                        suspend.mutate(s.id);
                    }}
                    title="Suspend supplier"
                    className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-red-300 hover:border-red-500/40 transition"
                  >
                    <Ban size={14} />
                  </button>
                )}
                <Link
                  href={`/admin/suppliers/${s.id}`}
                  title="View detail"
                  className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-dizajno-text hover:border-white/30 transition"
                >
                  <BadgeCheck size={14} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateSupplierModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
          }}
        />
      )}
    </>
  );
}

function CreateSupplierModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.createAdminSupplier({
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        description: description.trim() || null,
      }),
    onSuccess: () => onCreated(),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          create.mutate();
        }}
        className="w-full max-w-md rounded border border-white/15 bg-dizajno-bg px-6 py-6 space-y-4"
      >
        <h2 className="font-mono text-sm tracking-widest text-dizajno-text uppercase">
          New supplier
        </h2>
        <div className="space-y-1">
          <label className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Slug (URL-safe)
          </label>
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="acme-furniture"
            className="w-full rounded border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-sm text-dizajno-text focus:outline-none focus:border-white/30"
          />
        </div>
        <div className="space-y-1">
          <label className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Display name
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Furniture"
            className="w-full rounded border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-sm text-dizajno-text focus:outline-none focus:border-white/30"
          />
        </div>
        <div className="space-y-1">
          <label className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-sm text-dizajno-text focus:outline-none focus:border-white/30 resize-none"
          />
        </div>
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-amber-300 hover:bg-amber-500/20 transition disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
