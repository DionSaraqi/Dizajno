"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Send, Trash2 } from "lucide-react";
import * as api from "@/lib/api";

export default function AdminSupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();

  const supplier = useQuery({
    queryKey: ["admin", "supplier", id],
    queryFn: () => api.getAdminSupplier(id),
    enabled: !!id,
  });
  const members = useQuery({
    queryKey: ["admin", "supplier", id, "members"],
    queryFn: () => api.listSupplierMembers({ supplierId: id }),
    enabled: !!id,
  });
  const invites = useQuery({
    queryKey: ["admin", "supplier", id, "invites"],
    queryFn: () =>
      api.listSupplierInvites({ supplierId: id, includeRevoked: false, includeAccepted: true }),
    enabled: !!id,
  });

  const revoke = useMutation({
    mutationFn: (inviteId: string) => api.revokeSupplierInvite(inviteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "supplier", id, "invites"] }),
  });

  const [showInvite, setShowInvite] = useState(false);

  if (supplier.isLoading) {
    return <p className="font-mono text-sm text-dizajno-muted">Loading…</p>;
  }
  if (supplier.error) {
    return (
      <p className="font-mono text-sm text-red-400">{(supplier.error as Error).message}</p>
    );
  }
  if (!supplier.data) return null;

  const s = supplier.data;

  return (
    <>
      <Link
        href="/admin/suppliers"
        className="inline-flex items-center gap-2 text-dizajno-muted hover:text-dizajno-text font-mono text-xs tracking-widest uppercase mb-6"
      >
        <ArrowLeft size={12} /> Back to suppliers
      </Link>

      <div className="space-y-1 mb-8">
        <h2 className="font-mono text-2xl tracking-wide text-dizajno-text">{s.name}</h2>
        <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
          /{s.slug} · {s.productCount} products · {s.memberCount} members · created{" "}
          {new Date(s.createdAt).toLocaleDateString()}
        </p>
        <div className="flex gap-2 mt-2">
          {s.isTrusted && (
            <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase text-emerald-300">
              Trusted
            </span>
          )}
          {s.suspendedAt && (
            <span className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase text-red-300">
              Suspended {new Date(s.suspendedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        {s.description && (
          <p className="font-mono text-sm text-dizajno-text/80 mt-3 max-w-prose">
            {s.description}
          </p>
        )}
      </div>

      <section className="mb-10">
        <h3 className="font-mono text-sm tracking-widest text-dizajno-text uppercase mb-3">
          Members
        </h3>
        {members.data && members.data.length === 0 && (
          <p className="font-mono text-xs text-dizajno-muted">
            No members yet — send an invite below.
          </p>
        )}
        {members.data && members.data.length > 0 && (
          <ul className="space-y-2">
            {members.data.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded border border-white/10 bg-black/30 px-3 py-2"
              >
                <div>
                  <p className="font-mono text-sm text-dizajno-text">{m.userEmail}</p>
                  <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
                    {m.role} · joined {new Date(m.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
                  {m.role === "Owner" ? "Admin of supplier" : "Catalog only"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-sm tracking-widest text-dizajno-text uppercase">
            Invites
          </h3>
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-amber-300 hover:bg-amber-500/20 transition"
          >
            <Send size={12} /> New invite
          </button>
        </div>
        {invites.data && invites.data.length === 0 && (
          <p className="font-mono text-xs text-dizajno-muted">No invites yet.</p>
        )}
        {invites.data && invites.data.length > 0 && (
          <ul className="space-y-2">
            {invites.data.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded border border-white/10 bg-black/30 px-3 py-2"
              >
                <div>
                  <p className="font-mono text-sm text-dizajno-text">{inv.invitedEmail}</p>
                  <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
                    {inv.role}{" "}
                    {inv.acceptedAt
                      ? `· accepted ${new Date(inv.acceptedAt).toLocaleDateString()}`
                      : `· expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>
                {!inv.acceptedAt && !inv.revokedAt && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Revoke this invite? The link will stop working.")) {
                        revoke.mutate(inv.id);
                      }
                    }}
                    title="Revoke"
                    className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-red-300 hover:border-red-500/40 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {showInvite && (
        <CreateInviteModal
          supplierId={id}
          onClose={() => setShowInvite(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["admin", "supplier", id, "invites"] });
          }}
        />
      )}
    </>
  );
}

function CreateInviteModal({
  supplierId,
  onClose,
  onCreated,
}: {
  supplierId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<api.SupplierMemberRole>("Owner");
  const [days, setDays] = useState(14);
  const [issued, setIssued] = useState<api.SupplierInvite | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.createSupplierInvite({
        supplierId,
        email: email.trim(),
        role,
        expiresInDays: days,
      }),
    onSuccess: (inv) => {
      setIssued(inv);
      onCreated();
    },
  });

  if (issued) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
        <div className="w-full max-w-lg rounded border border-amber-500/40 bg-dizajno-bg px-6 py-6 space-y-4">
          <h2 className="font-mono text-sm tracking-widest text-amber-300 uppercase">
            Invite created — copy the link
          </h2>
          <p className="font-mono text-xs text-dizajno-muted">
            This is the only time you&apos;ll see the link. Forward it to{" "}
            <span className="text-dizajno-text">{issued.invitedEmail}</span> via whatever
            channel works.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={issued.acceptUrl ?? ""}
              className="flex-1 rounded border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-xs text-dizajno-text"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(issued.acceptUrl ?? "")}
              className="rounded border border-white/10 px-3 py-1.5 text-dizajno-muted hover:text-dizajno-text transition"
              title="Copy"
            >
              <Copy size={14} />
            </button>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-white/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="w-full max-w-md rounded border border-white/15 bg-dizajno-bg px-6 py-6 space-y-4"
      >
        <h2 className="font-mono text-sm tracking-widest text-dizajno-text uppercase">
          Invite a member
        </h2>
        <div className="space-y-1">
          <label className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Email (label only)
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-sm text-dizajno-text focus:outline-none focus:border-white/30"
          />
        </div>
        <div className="space-y-1">
          <label className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as api.SupplierMemberRole)}
            className="w-full rounded border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-sm text-dizajno-text focus:outline-none focus:border-white/30"
          >
            <option value="Owner">Owner (full supplier admin)</option>
            <option value="Staff">Staff (catalog + quotes)</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Expires in (days, 1–90)
          </label>
          <input
            type="number"
            min={1}
            max={90}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-full rounded border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-sm text-dizajno-text focus:outline-none focus:border-white/30"
          />
        </div>
        {create.error && (
          <p className="font-mono text-xs text-red-400">
            {(create.error as Error).message}
          </p>
        )}
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
            {create.isPending ? "Issuing…" : "Issue link"}
          </button>
        </div>
      </form>
    </div>
  );
}
