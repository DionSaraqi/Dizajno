"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase } from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

const POLL_MS = 30_000;

export default function SupplierQuotesPage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?redirect=/supplier/quotes");
    }
  }, [status, router]);

  const isMember = status === "authenticated" && (user?.supplierMemberships?.length ?? 0) > 0;

  const inbox = useQuery({
    queryKey: ["supplier", "quotes"],
    queryFn: () => api.listSupplierQuotes(),
    enabled: isMember,
    refetchInterval: POLL_MS,
  });

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg">
        <p className="font-mono text-sm text-dizajno-muted">Loading…</p>
      </main>
    );
  }

  if (!isMember) {
    return (
      <main className="min-h-screen w-screen bg-dizajno-bg blueprint-grid">
        <header className="flex items-center gap-4 px-8 py-5 border-b border-white/10 backdrop-blur">
          <Link
            href="/"
            className="text-dizajno-muted hover:text-dizajno-text transition"
            aria-label="Back to home"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-mono text-lg tracking-[0.2em] text-dizajno-text">
              SUPPLIER PORTAL
            </h1>
          </div>
        </header>
        <section className="max-w-3xl mx-auto px-8 py-16">
          <div className="rounded border border-white/10 bg-black/30 px-8 py-12 text-center">
            <Briefcase size={36} className="mx-auto text-dizajno-muted/60 mb-4" />
            <p className="font-mono text-sm text-dizajno-muted leading-relaxed">
              You&apos;re not bound to any supplier yet. Ask an admin to bind your account
              to a supplier on this Dizajno instance — the full self-service portal lands in
              Phase 7.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-screen bg-dizajno-bg blueprint-grid">
      <header className="flex items-center gap-4 px-8 py-5 border-b border-white/10 backdrop-blur">
        <Link
          href="/projects"
          className="text-dizajno-muted hover:text-dizajno-text transition"
          aria-label="Back to projects"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-mono text-lg tracking-[0.2em] text-dizajno-text">
            SUPPLIER INBOX
          </h1>
          <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            {user?.supplierMemberships.map((m) => m.supplierName).join(" · ")}
          </p>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-8 py-10">
        {inbox.isLoading && (
          <p className="font-mono text-sm text-dizajno-muted">Loading inbox…</p>
        )}
        {inbox.error && (
          <p className="font-mono text-sm text-red-400 break-words">
            {(inbox.error as Error).message}
          </p>
        )}
        {inbox.data && inbox.data.length === 0 && (
          <p className="font-mono text-sm text-dizajno-muted">
            No quote requests yet. They&apos;ll appear here as customers submit them.
          </p>
        )}
        {inbox.data && inbox.data.length > 0 && (
          <ul className="space-y-3">
            {inbox.data.map((req) => (
              <li
                key={req.id}
                className="rounded-lg border border-white/10 bg-black/30 hover:bg-black/40 transition"
              >
                <Link href={`/supplier/quotes/${req.id}`} className="block px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-dizajno-text truncate">
                        {req.projectName}
                      </p>
                      <p className="font-mono text-[10px] tracking-widest text-dizajno-muted/70 uppercase mt-0.5">
                        From {req.requesterDisplayName} · {req.lineCount}{" "}
                        {req.lineCount === 1 ? "line" : "lines"}
                      </p>
                    </div>
                    <RequestStatusPill status={req.status} hasResponse={req.hasResponse} />
                  </div>
                  <p className="font-mono text-[10px] tracking-widest text-dizajno-muted/50 uppercase mt-2">
                    {new Date(req.createdAt).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function RequestStatusPill({
  status,
  hasResponse,
}: {
  status: api.QuoteRequestStatus;
  hasResponse: boolean;
}) {
  const label = hasResponse && status === "Responded" ? "REPLIED" : status.toUpperCase();
  const colour =
    status === "Pending"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
      : status === "Responded"
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
        : "bg-white/10 text-dizajno-muted border-white/20";
  return (
    <span
      className={`rounded border px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase whitespace-nowrap ${colour}`}
    >
      {label}
    </span>
  );
}
