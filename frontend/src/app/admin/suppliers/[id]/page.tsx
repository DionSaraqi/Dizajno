"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Send,
  Store,
  Trash2,
  UserCircle2,
  UserPlus,
} from "lucide-react";
import * as api from "@/lib/api";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  FormField,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Tooltip,
} from "@/components/ui";

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
      api.listSupplierInvites({
        supplierId: id,
        includeRevoked: false,
        includeAccepted: true,
      }),
    enabled: !!id,
  });

  const [showInvite, setShowInvite] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<api.SupplierInvite | null>(
    null,
  );

  const revoke = useMutation({
    mutationFn: (inviteId: string) => api.revokeSupplierInvite(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["admin", "supplier", id, "invites"],
      });
      setRevokeTarget(null);
    },
  });

  if (supplier.isLoading) {
    return (
      <div className="py-16 flex items-center justify-center gap-2 text-dizajno-muted text-sm">
        <Spinner /> Loading supplier…
      </div>
    );
  }
  if (supplier.error) {
    return (
      <div className="py-12 max-w-xl">
        <div className="rounded-xl border border-dizajno-danger/30 bg-dizajno-danger-soft px-4 py-3 text-[13px] text-dizajno-danger">
          {(supplier.error as Error).message}
        </div>
      </div>
    );
  }
  if (!supplier.data) return null;

  const s = supplier.data;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Suppliers", href: "/admin/suppliers" },
          { label: s.name },
        ]}
        title={s.name}
        description={
          <span className="inline-flex items-center gap-2 mt-1 flex-wrap">
            <span className="font-mono text-[12.5px] text-dizajno-muted">
              /{s.slug}
            </span>
            <span className="text-dizajno-muted-subtle">·</span>
            <span className="text-[12.5px] text-dizajno-muted">
              {s.productCount} product{s.productCount === 1 ? "" : "s"}
            </span>
            <span className="text-dizajno-muted-subtle">·</span>
            <span className="text-[12.5px] text-dizajno-muted">
              {s.memberCount} member{s.memberCount === 1 ? "" : "s"}
            </span>
            <span className="text-dizajno-muted-subtle">·</span>
            <span className="text-[12.5px] text-dizajno-muted">
              joined {new Date(s.createdAt).toLocaleDateString()}
            </span>
            {s.isTrusted && (
              <Badge tone="success" size="sm" dot>
                Trusted
              </Badge>
            )}
            {s.suspendedAt && (
              <Badge tone="danger" size="sm" dot>
                Suspended {new Date(s.suspendedAt).toLocaleDateString()}
              </Badge>
            )}
          </span>
        }
      />

      <section className="py-6 max-w-4xl space-y-8">
        {s.description && (
          <Card>
            <CardBody>
              <p className="text-[13.5px] text-dizajno-text-subtle leading-relaxed max-w-prose">
                {s.description}
              </p>
            </CardBody>
          </Card>
        )}

        {/* Members */}
        <Card flush>
          <header className="px-5 pt-4 pb-3 border-b border-dizajno-border flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-dizajno-text">
                Members
              </h3>
              <p className="text-[12.5px] text-dizajno-muted mt-0.5">
                People with access to this supplier&apos;s portal.
              </p>
            </div>
          </header>
          {members.data && members.data.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Store
                size={28}
                className="mx-auto text-dizajno-muted-subtle mb-2"
                strokeWidth={1.5}
              />
              <p className="text-[13px] text-dizajno-muted">
                No members yet — issue an invite below.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-dizajno-border">
              {members.data?.map((m) => (
                <li key={m.id} className="px-5 py-3.5 flex items-center gap-4">
                  <Avatar
                    size={32}
                    fallback={m.userEmail.slice(0, 2)}
                    alt={m.userEmail}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-dizajno-text truncate">
                      {m.userEmail}
                    </p>
                    <p className="text-[11.5px] text-dizajno-muted mt-0.5">
                      Joined {new Date(m.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    tone={m.role === "Owner" ? "accent" : "neutral"}
                    size="sm"
                    dot
                  >
                    {m.role === "Owner" ? "Owner" : "Staff"}
                  </Badge>
                </li>
              ))}
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
                Admin-issued. Owners can also issue their own invites from the portal.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<UserPlus />}
              onClick={() => setShowInvite(true)}
            >
              New invite
            </Button>
          </header>
          {invites.data && invites.data.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <UserCircle2
                size={28}
                className="mx-auto text-dizajno-muted-subtle mb-2"
                strokeWidth={1.5}
              />
              <p className="text-[13px] text-dizajno-muted">No invites yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-dizajno-border">
              {invites.data?.map((inv) => {
                const accepted = !!inv.acceptedAt;
                return (
                  <li
                    key={inv.id}
                    className="px-5 py-3.5 flex items-center gap-4"
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
                        <span className="mx-1.5 text-dizajno-muted-subtle">·</span>
                        {accepted
                          ? `Accepted ${new Date(inv.acceptedAt!).toLocaleDateString()}`
                          : `Expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    {accepted ? (
                      <Badge tone="success" size="sm" dot>
                        Accepted
                      </Badge>
                    ) : (
                      <Badge tone="warning" size="sm" dot>
                        Pending
                      </Badge>
                    )}
                    {!accepted && !inv.revokedAt && (
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
        <CreateInviteModal
          supplierId={id}
          onClose={() => setShowInvite(false)}
          onCreated={() => {
            qc.invalidateQueries({
              queryKey: ["admin", "supplier", id, "invites"],
            });
          }}
        />
      )}

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
        busy={revoke.isPending}
        onConfirm={() => revokeTarget && revoke.mutate(revokeTarget.id)}
        onCancel={() => setRevokeTarget(null)}
      />
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
  const [copied, setCopied] = useState(false);

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
      <Modal
        open={true}
        onClose={onClose}
        title="Invite link ready"
        description="The token is shown once. Send it to the invitee via whatever channel works."
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
          <FormField
            label="Accept URL"
            hint="One-time copy — only the hash is persisted."
          >
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
      description="Admin-issued invites are tracked in the audit log as supplier_invite.create. The recipient picks how to log in."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="admin-invite-form"
            variant="primary"
            loading={create.isPending}
            leftIcon={!create.isPending ? <Send /> : undefined}
          >
            {create.isPending ? "Issuing…" : "Issue link"}
          </Button>
        </>
      }
    >
      <form
        id="admin-invite-form"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-3"
      >
        <FormField label="Email" hint="Label only — link is delivered out-of-band" required>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="founder@acme.example"
          />
        </FormField>
        <FormField label="Role">
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as api.SupplierMemberRole)}
          >
            <option value="Owner">Owner — full supplier admin</option>
            <option value="Staff">Staff — catalog + quotes</option>
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
        {create.error && (
          <div className="rounded-lg border border-dizajno-danger/30 bg-dizajno-danger-soft px-3 py-2 text-[13px] text-dizajno-danger">
            {(create.error as Error).message}
          </div>
        )}
      </form>
    </Modal>
  );
}
