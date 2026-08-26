"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Mailbox,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import AuthShell from "@/components/auth/AuthShell";
import { ApiErrorAlert, Badge, Button, Spinner } from "@/components/ui";

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  const preview = useQuery({
    queryKey: ["invite", token],
    queryFn: () => api.previewInvite(token),
    enabled: !!token,
    retry: false,
  });

  const [accepted, setAccepted] = useState(false);
  const accept = useMutation({
    meta: { errorHandled: true },
    mutationFn: () => api.acceptInvite(token),
    onSuccess: () => {
      setAccepted(true);
      useAuthStore.getState().bootstrap();
    },
  });

  const redirectTarget = `/invite/${token}`;

  useEffect(() => {
    if (accepted) {
      const timer = setTimeout(() => router.push("/projects"), 2500);
      return () => clearTimeout(timer);
    }
  }, [accepted, router]);

  if (preview.isLoading) {
    return (
      <AuthShell eyebrow="Invitation" title="Loading…">
        <div className="flex items-center gap-3 text-dizajno-muted text-[14px]">
          <Spinner size={16} />
          Checking your invite…
        </div>
      </AuthShell>
    );
  }

  if (preview.error) {
    return (
      <AuthShell
        eyebrow="Invitation"
        title="Invite not found."
        subtitle="The link may be mistyped, expired, or revoked. Ask the person who invited you for a fresh one."
        footer={
          <Link
            href="/login"
            className="text-dizajno-text font-medium hover:text-dizajno-accent transition-colors"
          >
            Go to sign in →
          </Link>
        }
      >
        <StatusCard
          tone="danger"
          icon={<ShieldAlert />}
          title="Couldn't verify this invitation"
          body="The invite link doesn't match anything in our system."
        />
      </AuthShell>
    );
  }

  const data = preview.data;
  if (!data) return null;

  if (accepted) {
    return (
      <AuthShell
        eyebrow="Welcome aboard"
        title={`Joined ${data.supplierName}.`}
        subtitle="Redirecting you to your projects in a moment."
      >
        <StatusCard
          tone="success"
          icon={<ShieldCheck />}
          title="Membership confirmed"
          body={`You're now a ${data.role} of ${data.supplierName}.`}
        />
      </AuthShell>
    );
  }

  if (data.isExpired) {
    return (
      <AuthShell eyebrow="Invitation" title="This invite has expired.">
        <StatusCard
          tone="danger"
          icon={<ShieldAlert />}
          title="Expired"
          body="Ask the admin or supplier owner to send you a new invitation."
        />
      </AuthShell>
    );
  }

  if (data.isRevoked) {
    return (
      <AuthShell eyebrow="Invitation" title="This invite was revoked.">
        <StatusCard
          tone="danger"
          icon={<ShieldAlert />}
          title="Revoked"
          body="The link is no longer valid. Reach out to whoever invited you."
        />
      </AuthShell>
    );
  }

  if (data.isAccepted) {
    return (
      <AuthShell eyebrow="Invitation" title="Already accepted.">
        <StatusCard
          tone="neutral"
          icon={<CheckCircle2 />}
          title="This invite has already been redeemed"
          body="If that wasn't you, please contact the supplier owner."
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Invitation"
      title={`Join ${data.supplierName}.`}
      subtitle={
        data.role === "Owner"
          ? "You've been invited as an Owner — full access to the supplier's catalog, members, and profile."
          : "You've been invited as Staff — you'll be able to edit the supplier's catalog."
      }
    >
      <div className="rounded-xl border border-dizajno-border bg-dizajno-surface p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-dizajno-accent-soft text-dizajno-accent flex items-center justify-center">
            <Mailbox size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-dizajno-text">
              {data.supplierName}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <Badge tone="accent" size="sm" dot>
                {data.role}
              </Badge>
              <span className="text-[12px] text-dizajno-muted">
                {data.role === "Owner"
                  ? "Full supplier admin"
                  : "Catalog editor"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        {status === "authenticated" ? (
          <>
            <p className="text-[13px] text-dizajno-muted mb-3">
              Signed in as{" "}
              <span className="text-dizajno-text font-medium">
                {user?.email}
              </span>
            </p>
            {accept.error && (
              <ApiErrorAlert
                error={accept.error}
                action="accept this invitation"
                size="sm"
                className="mb-3"
              />
            )}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={accept.isPending}
              rightIcon={!accept.isPending ? <ArrowRight /> : undefined}
              onClick={() => accept.mutate()}
            >
              {accept.isPending ? "Accepting…" : "Accept invitation"}
            </Button>
          </>
        ) : (
          <div className="space-y-2">
            <Link
              href={`/login?redirect=${encodeURIComponent(redirectTarget)}`}
              className="block"
            >
              <Button variant="primary" size="lg" fullWidth rightIcon={<ArrowRight />}>
                Sign in to accept
              </Button>
            </Link>
            <Link
              href={`/register?redirect=${encodeURIComponent(redirectTarget)}`}
              className="block"
            >
              <Button variant="ghost" size="lg" fullWidth>
                Or create a new account
              </Button>
            </Link>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

function StatusCard({
  tone,
  icon,
  title,
  body,
}: {
  tone: "success" | "danger" | "neutral";
  icon: React.ReactNode;
  title: React.ReactNode;
  body: React.ReactNode;
}) {
  const toneStyles = {
    success:
      "border-dizajno-success/30 bg-dizajno-success-soft text-dizajno-success",
    danger:
      "border-dizajno-danger/30 bg-dizajno-danger-soft text-dizajno-danger",
    neutral:
      "border-dizajno-border bg-dizajno-elevated text-dizajno-text-subtle",
  }[tone];

  return (
    <div
      className={["rounded-xl border p-4 flex items-start gap-3", toneStyles].join(
        " ",
      )}
    >
      <div className="[&_svg]:size-5 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="font-semibold text-[13.5px] leading-snug">{title}</div>
        <div className="mt-0.5 text-[12.5px] opacity-90 leading-relaxed">
          {body}
        </div>
      </div>
    </div>
  );
}
