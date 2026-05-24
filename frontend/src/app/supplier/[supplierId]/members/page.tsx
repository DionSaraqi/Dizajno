"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  Copy,
  Send,
  ShieldAlert,
  Trash2,
  UserCircle2,
  UserPlus,
} from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FormField,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Select,
  Tooltip,
} from "@/components/ui";

export default function SupplierMembersPage() {
  const params = useParams<{ supplierId: string }>();
  const router = useRouter();
  const supplierId = params.supplierId;
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<api.SupplierPortalMember | null>(
    null,
  );
  const [revokeTarget, setRevokeTarget] = useState<api.SupplierInvite | null>(
    null,
  );

  const me = useAuthStore((s) => s.user);
  const myMembership = me?.supplierMemberships.find(
    (m) => m.supplierId === supplierId,
  );
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
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["supplier", supplierId, "members"] }),
    onError: (e: Error) => setErrorMessage(e.message),
  });
  const removeMember = useMutation({
    mutationFn: (id: string) => api.removeSupplierMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier", supplierId, "members"] });
      setRemoveTarget(null);
    },
    onError: (e: Error) => setErrorMessage(e.message),
  });
  const revokeInvite = useMutation({
    mutationFn: (id: string) => api.revokeSupplierPortalInvite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier", supplierId, "invites"] });
      setRevokeTarget(null);
    },
    onError: (e: Error) => setErrorMessage(e.message),
  });

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title="Members & invites"
        description="Add, promote, and remove people who can edit this supplier's catalog and respond to quotes."
        actions={
          isOwner && (
            <Button
              variant="primary"
              leftIcon={<UserPlus />}
              onClick={() => setShowInvite(true)}
            >
              Invite member
            </Button>
          )
        }
      />

      <section className="py-6 max-w-4xl space-y-8">
        {!isOwner && (
          <div className="rounded-lg border border-dizajno-warning/30 bg-dizajno-warning-soft px-4 py-3 text-[13px] text-dizajno-warning flex items-start gap-2">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            <span>
              You're viewing as <strong>Staff</strong>. Promote, remove, and
              invite actions are Owner-only and will 403.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-lg border border-dizajno-danger/30 bg-dizajno-danger-soft px-4 py-3 text-[13px] text-dizajno-danger flex items-start justify-between gap-3">
            <span className="flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {errorMessage}
            </span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-dizajno-danger/70 hover:text-dizajno-danger text-[12px] font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Members */}
        <Card flush>
          <header className="px-5 pt-4 pb-3 border-b border-dizajno-border flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-dizajno-text">
                Members
              </h3>
              <p className="text-[12.5px] text-dizajno-muted mt-0.5">
                {members.data?.length ?? 0} active
              </p>
            </div>
          </header>

          {members.data && members.data.length === 0 && (
            <div className="px-5 py-10 text-center text-[13px] text-dizajno-muted">
              No members yet.
            </div>
          )}

          {members.data && members.data.length > 0 && (
            <ul className="divide-y divide-dizajno-border">
              {members.data.map((m) => {
                const isSelf = me?.id === m.userId;
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-4 px-5 py-3.5"
                  >
                    <Avatar
                      size={32}
                      fallback={m.userEmail.slice(0, 2)}
                      alt={m.userEmail}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[13.5px] font-medium text-dizajno-text truncate">
                          {m.userEmail}
                        </p>
                        {isSelf && (
                          <Badge tone="accent" size="sm">
                            You
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11.5px] text-dizajno-muted mt-0.5">
                        Joined {new Date(m.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOwner ? (
                        <Select
                          size="sm"
                          value={m.role}
                          onChange={(e) =>
                            changeRole.mutate({
                              id: m.id,
                              role: e.target.value as api.SupplierMemberRole,
                            })
                          }
                          disabled={changeRole.isPending}
                          className="w-28"
                        >
                          <option value="Owner">Owner</option>
                          <option value="Staff">Staff</option>
                        </Select>
                      ) : (
                        <Badge
                          tone={m.role === "Owner" ? "accent" : "neutral"}
                          size="sm"
                          dot
                        >
                          {m.role}
                        </Badge>
                      )}
                      {isOwner && (
                        <Tooltip content={isSelf ? "Remove yourself" : "Remove"}>
                          <IconButton
                            variant="danger"
                            size="sm"
                            onClick={() => setRemoveTarget(m)}
                          >
                            <Trash2 />
                          </IconButton>
                        </Tooltip>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Invites */}
        <Card flush>
          <header className="px-5 pt-4 pb-3 border-b border-dizajno-border flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-dizajno-text">
                Invites
              </h3>
              <p className="text-[12.5px] text-dizajno-muted mt-0.5">
                Tokenized links — only the recipient can accept.
              </p>
            </div>
          </header>

          {invites.data && invites.data.length === 0 && (
            <div className="px-5 py-10 text-center">
              <UserCircle2
                size={28}
                className="text-dizajno-muted-subtle mx-auto mb-2"
                strokeWidth={1.5}
              />
              <p className="text-[13px] text-dizajno-muted">No outstanding invites.</p>
            </div>
          )}

          {invites.data && invites.data.length > 0 && (
            <ul className="divide-y divide-dizajno-border">
              {invites.data.map((inv) => {
                const isAccepted = !!inv.acceptedAt;
                return (
                  <li
                    key={inv.id}
                    className="flex items-center gap-4 px-5 py-3.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-dizajno-elevated text-dizajno-muted flex items-center justify-center shrink-0">
                      <Send size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-dizajno-text truncate">
                        {inv.invitedEmail}
                      </p>
                      <p className="text-[11.5px] text-dizajno-muted mt-0.5">
                        {inv.role}
                        <span className="mx-1.5 text-dizajno-muted-subtle">
                          ·
                        </span>
                        {isAccepted
                          ? `Accepted ${new Date(inv.acceptedAt!).toLocaleDateString()}`
                          : `Expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    {isAccepted ? (
                      <Badge tone="success" size="sm" dot>
                        Accepted
                      </Badge>
                    ) : (
                      <Badge tone="warning" size="sm" dot>
                        Pending
                      </Badge>
                    )}
                    {isOwner && !isAccepted && !inv.revokedAt && (
                      <Tooltip content="Revoke">
                        <IconButton
                          variant="danger"
                          size="sm"
                          onClick={() => setRevokeTarget(inv)}
                        >
                          <Trash2 />
                        </IconButton>
                      </Tooltip>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {showInvite && (
        <InviteModal
          supplierId={supplierId}
          onClose={() => setShowInvite(false)}
          onIssued={() => {
            qc.invalidateQueries({
              queryKey: ["supplier", supplierId, "invites"],
            });
          }}
        />
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title={
          me?.id === removeTarget?.userId
            ? "Leave this supplier?"
            : "Remove member?"
        }
        description={
          removeTarget
            ? me?.id === removeTarget.userId
              ? "You'll lose portal access immediately. An Owner will need to invite you back."
              : `${removeTarget.userEmail} will lose access to this portal.`
            : ""
        }
        confirmLabel="Remove"
        confirmTone="danger"
        busy={removeMember.isPending}
        onConfirm={() =>
          removeTarget &&
          removeMember.mutate(removeTarget.id, {
            onSuccess: () => {
              if (me?.id === removeTarget.userId) router.replace("/supplier");
            },
          })
        }
        onCancel={() => setRemoveTarget(null)}
      />

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke invite?"
        description={
          revokeTarget
            ? `The link sent to ${revokeTarget.invitedEmail} will stop working immediately.`
            : ""
        }
        confirmLabel="Revoke"
        confirmTone="danger"
        busy={revokeInvite.isPending}
        onConfirm={() => revokeTarget && revokeInvite.mutate(revokeTarget.id)}
        onCancel={() => setRevokeTarget(null)}
      />
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
  const [copied, setCopied] = useState(false);
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
      <Modal
        open={true}
        onClose={onClose}
        title="Invite link ready"
        description="The token is only shown once. Send it via whatever channel works — email, Slack, message, anything."
        size="md"
        modal
        footer={
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-dizajno-success/30 bg-dizajno-success-soft px-4 py-3 flex items-start gap-2 text-[13px] text-dizajno-success">
            <Check size={14} className="mt-0.5 shrink-0" />
            <span>
              Invite issued for{" "}
              <span className="font-medium">{issued.invitedEmail}</span> as{" "}
              <span className="font-medium">{issued.role}</span>.
            </span>
          </div>
          <FormField label="Accept URL" hint="One-time copy — we don't store this in plaintext.">
            <div className="flex gap-2">
              <Input
                readOnly
                value={issued.acceptUrl ?? ""}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-[12px]"
              />
              <Button
                variant="secondary"
                leftIcon={copied ? <Check /> : <Copy />}
                onClick={() => {
                  navigator.clipboard.writeText(issued.acceptUrl ?? "");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </FormField>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Invite a member"
      description="Generates a unique link. The email is a label only — delivery is up to you."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={issue.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="invite-form"
            variant="primary"
            loading={issue.isPending}
            leftIcon={!issue.isPending ? <Send /> : undefined}
          >
            {issue.isPending ? "Issuing…" : "Issue link"}
          </Button>
        </>
      }
    >
      <form
        id="invite-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          issue.mutate();
        }}
        className="space-y-3"
      >
        <FormField label="Email" required>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@studio.com"
          />
        </FormField>
        <FormField label="Role">
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as api.SupplierMemberRole)}
          >
            <option value="Staff">Staff — catalog + quotes</option>
            <option value="Owner">Owner — full supplier admin</option>
          </Select>
        </FormField>
        <FormField label="Expires in" hint="Days (1–90)">
          <Input
            type="number"
            min={1}
            max={90}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </FormField>
        {error && (
          <div className="rounded-lg border border-dizajno-danger/30 bg-dizajno-danger-soft px-3 py-2 text-[13px] text-dizajno-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
