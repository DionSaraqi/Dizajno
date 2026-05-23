"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, MailOpen, ShieldAlert } from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Standalone page (no /admin layout) — accessible without authentication so
 * the invitee can read who they're joining before being forced to login.
 * Tracks 3 visual states: invalid/expired/revoked, ready-to-accept (logged in),
 * and ready-to-accept (logged out — sends to login with redirect).
 */
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
    mutationFn: () => api.acceptInvite(token),
    onSuccess: () => {
      setAccepted(true);
      // Refresh the user summary so the new SupplierMembership shows up in nav.
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

  return (
    <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg blueprint-grid px-4">
      <div className="w-full max-w-md rounded border border-white/15 bg-black/40 backdrop-blur px-8 py-10 space-y-6">
        {preview.isLoading && (
          <p className="font-mono text-sm text-dizajno-muted text-center">Loading invite…</p>
        )}
        {preview.error && (
          <div className="text-center space-y-2">
            <ShieldAlert size={32} className="mx-auto text-red-400" />
            <p className="font-mono text-sm text-red-300">Invite not found.</p>
            <p className="font-mono text-xs text-dizajno-muted">
              The link may be mistyped or has been revoked.
            </p>
          </div>
        )}
        {preview.data && (
          <>
            {accepted ? (
              <div className="text-center space-y-3">
                <CheckCircle2 size={36} className="mx-auto text-emerald-300" />
                <p className="font-mono text-sm text-emerald-200">
                  Joined {preview.data.supplierName}.
                </p>
                <p className="font-mono text-xs text-dizajno-muted">
                  Redirecting to your projects…
                </p>
              </div>
            ) : preview.data.isExpired ? (
              <Info icon={<ShieldAlert className="text-red-400" size={32} />} tone="red">
                This invite has expired. Ask the admin to issue a fresh one.
              </Info>
            ) : preview.data.isRevoked ? (
              <Info icon={<ShieldAlert className="text-red-400" size={32} />} tone="red">
                This invite has been revoked.
              </Info>
            ) : preview.data.isAccepted ? (
              <Info icon={<CheckCircle2 className="text-emerald-300" size={32} />} tone="green">
                This invite was already accepted.
              </Info>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <MailOpen size={32} className="mx-auto text-amber-300" />
                  <p className="font-mono text-xs tracking-widest uppercase text-dizajno-muted">
                    You&apos;re invited to join
                  </p>
                  <p className="font-mono text-xl text-dizajno-text">
                    {preview.data.supplierName}
                  </p>
                  <p className="font-mono text-[10px] tracking-widest uppercase text-dizajno-muted">
                    as {preview.data.role} ·{" "}
                    {preview.data.role === "Owner"
                      ? "full supplier admin"
                      : "catalog editor"}
                  </p>
                </div>

                {status === "authenticated" ? (
                  <>
                    <p className="font-mono text-xs text-dizajno-muted text-center">
                      Signed in as{" "}
                      <span className="text-dizajno-text">{user?.email}</span>
                    </p>
                    {accept.error && (
                      <p className="font-mono text-xs text-red-400 text-center">
                        {(accept.error as Error).message}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={accept.isPending}
                      onClick={() => accept.mutate()}
                      className="w-full rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-mono text-xs tracking-widest uppercase text-amber-300 hover:bg-amber-500/20 transition disabled:opacity-50"
                    >
                      {accept.isPending ? "Accepting…" : "Accept invite"}
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Link
                      href={`/login?redirect=${encodeURIComponent(redirectTarget)}`}
                      className="block text-center rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-mono text-xs tracking-widest uppercase text-amber-300 hover:bg-amber-500/20 transition"
                    >
                      Log in to accept
                    </Link>
                    <Link
                      href={`/register?redirect=${encodeURIComponent(redirectTarget)}`}
                      className="block text-center rounded border border-white/10 px-3 py-2 font-mono text-xs tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text transition"
                    >
                      Or register a new account
                    </Link>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Info({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone: "red" | "green";
  children: React.ReactNode;
}) {
  const color = tone === "red" ? "text-red-300" : "text-emerald-300";
  return (
    <div className="text-center space-y-2">
      <div className="mx-auto">{icon}</div>
      <p className={`font-mono text-sm ${color}`}>{children}</p>
    </div>
  );
}
