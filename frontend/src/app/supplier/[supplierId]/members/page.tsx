"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Send, Trash2 } from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Owner-only member management. Staff can see the roster (read-only) via the
 * portal layout's nav restriction; but if they URL-hack their way here, the
 * mutation endpoints 403 server-side anyway.
 */
export default function SupplierMembersPage() {
  const params = useParams<{ supplierId: string }>();
  const router = useRouter();
  const supplierId = params.supplierId;
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);

  const me = useAuthStore((s) => s.user);
  const myMembership = me?.supplierMemberships.find((m) => m.supplierId === supplierId);
  const isOwner = myMembership?.role === "Owner";

  const members = useQuery({
    queryKey: ["supplier", supplierId, "members"],
    queryFn: () => api.listSupplierPortalMembers(supplierId),
  });
  const invites = useQuery({
    queryKey: ["supplier", supplierId, "invites"],
    queryFn: () =>
      api.listSupplierPortalInvites(supplierId, {
        includeRevoked: false,
        includeAccepted: true,
      }),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: api.SupplierMemberRole }) =>
      api.changeSupplierMemberRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier", supplierId, "members"] }),
    onError: (e: Error) => alert(e.message),
  });
  const removeMember = useMutation({
    mutationFn: (id: string) => api.removeSupplierMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier", supplierId, "members"] }),
    onError: (e: Error) => alert(e.message),
  });
  const revokeInvite = useMutation({
    mutationFn: (id: string) => api.revokeSupplierPortalInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier", supplierId, "invites"] }),
  });

  return (
    <>
      {!isOwner && (
        <p className="font-mono text-xs text-amber-300 mb-4">
          You&apos;re viewing as Staff. Promote, remove, and invite actions are Owner-only and will 403.
        </p>
      )}

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-sm tracking-widest text-dizajno-text uppercase">
            Members
          </h3>
        </div>
        {members.data && members.data.length === 0 && (
          <p className="font-mono text-xs text-dizajno-muted">No members yet.</p>
        )}
        {members.data && members.data.length > 0 && (
          <ul className="space-y-2">
            {members.data.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm text-dizajno-text truncate">{m.userEmail}</p>
                  <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
                    {m.role} · joined {new Date(m.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {isOwner && (
                    <select
                      value={m.role}
                      onChange={(e) =>
                        changeRole.mutate({ id: m.id, role: e.target.value as api.SupplierMemberRole })
                      }
                      className="rounded border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs text-dizajno-text"
                      disabled={changeRole.isPending}
                    >
                      <option value="Owner">Owner</option>
                      <option value="Staff">Staff</option>
                    </select>
                  )}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        const isSelf = me?.id === m.userId;
                        const confirmMsg = isSelf
                          ? "Remove yourself from this supplier? You'll lose portal access immediately."
                          : `Remove ${m.userEmail}?`;
                        if (confirm(confirmMsg)) {
                          removeMember.mutate(m.id, {
                            onSuccess: () => {
                              if (isSelf) router.replace("/supplier");
                            },
                          });
                        }
                      }}
                      className="rounded border border-white/10 px-2 py-1 text-dizajno-muted hover:text-red-300 hover:border-red-500/40 transition"
                      title="Remove member"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-sm tracking-widest text-dizajno-text uppercase">
            Invites
          </h3>
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              <Send size={12} /> Invite a member
            </button>
          )}
        </div>
        {invites.data && invites.data.length === 0 && (
          <p className="font-mono text-xs text-dizajno-muted">No invites yet.</p>
        )}
        {invites.data && invites.data.length > 0 && (
          <ul className="space-y-2">
            {invites.data.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm text-dizajno-text truncate">{inv.invitedEmail}</p>
                  <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
                    {inv.role}
                    {inv.acceptedAt
                      ? ` · accepted ${new Date(inv.acceptedAt).toLocaleDateString()}`
                      : ` · expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>
                {isOwner && !inv.acceptedAt && !inv.revokedAt && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Revoke this invite? The link will stop working.")) {
                        revokeInvite.mutate(inv.id);
                      }
                    }}
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
        <InviteModal
          supplierId={supplierId}
          onClose={() => setShowInvite(false)}
          onIssued={() => {
            qc.invalidateQueries({ queryKey: ["supplier", supplierId, "invites"] });
          }}
        />
      )}
    </>
  );
}

function InviteModal({
  supplierId,
  onClose,
  onIssued,
}: {
  supplierId: string;
  onClose: () => void;
  onIssued: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<api.SupplierMemberRole>("Staff");
  const [days, setDays] = useState(14);
  const [issued, setIssued] = useState<api.SupplierInvite | null>(null);
  const [error, setError] = useState<string | null>(null);

  const issue = useMutation({
    mutationFn: () =>
      api.createSupplierPortalInvite({
        supplierId,
        email: email.trim(),
        role,
        expiresInDays: days,
      }),
    onSuccess: (dto) => {
      setIssued(dto);
      onIssued();
    },
    onError: (e: Error) => setError(e.message),
  });

  if (issued) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur px-4">
        <div className="w-full max-w-lg rounded border border-emerald-500/40 bg-dizajno-bg px-6 py-6 space-y-4">
          <h2 className="font-mono text-sm tracking-widest text-emerald-300 uppercase">
            Invite link — copy it now
          </h2>
          <p className="font-mono text-xs text-dizajno-muted">
            The token is only shown once. Forward the URL to{" "}
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
          <div className="flex justify-end">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          issue.mutate();
        }}
        className="w-full max-w-md rounded border border-white/15 bg-dizajno-bg px-6 py-6 space-y-4"
      >
        <h2 className="font-mono text-sm tracking-widest text-dizajno-text uppercase">
          Invite a member
        </h2>
        <label className="block space-y-1">
          <span className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Email (label only — link delivered out-of-band)
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="portal-input"
          />
        </label>
        <label className="block space-y-1">
          <span className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Role
          </span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as api.SupplierMemberRole)}
            className="portal-input"
          >
            <option value="Staff">Staff (catalog + quotes)</option>
            <option value="Owner">Owner (full supplier admin)</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Expires in (days, 1–90)
          </span>
          <input
            type="number"
            min={1}
            max={90}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="portal-input"
          />
        </label>
        {error && <p className="font-mono text-xs text-red-400 break-words">{error}</p>}
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
            disabled={issue.isPending}
            className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
          >
            {issue.isPending ? "Issuing…" : "Issue link"}
          </button>
        </div>
      </form>
    </div>
  );
}
