"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Briefcase, Store } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Supplier portal entry. Auto-redirects single-supplier users straight into
 * their portal; everyone else picks from a list. Suspended suppliers are
 * shown but greyed out — clicking them lands on a page that explains the
 * portal is locked, so users can still reach the membership listing.
 */
export default function SupplierIndexPage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  const memberships = user?.supplierMemberships ?? [];
  const activeMemberships = memberships.filter((m) => !m.isSuspended);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?redirect=/supplier");
      return;
    }
    if (status === "authenticated" && activeMemberships.length === 1) {
      router.replace(`/supplier/${activeMemberships[0].supplierId}/products`);
    }
  }, [status, activeMemberships, router]);

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg blueprint-grid">
        <p className="font-mono text-sm text-dizajno-muted tracking-wider">Loading…</p>
      </main>
    );
  }

  if (memberships.length === 0) {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg blueprint-grid px-4">
        <div className="max-w-md text-center space-y-4 rounded border border-white/15 bg-black/40 backdrop-blur px-8 py-10">
          <Briefcase size={32} className="mx-auto text-dizajno-muted" />
          <h1 className="font-mono text-lg tracking-widest uppercase text-dizajno-text">
            No supplier memberships
          </h1>
          <p className="font-mono text-xs text-dizajno-muted">
            Ask the admin to invite you to a supplier, then come back here.
          </p>
          <Link
            href="/projects"
            className="inline-block rounded border border-white/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text transition"
          >
            Back to projects
          </Link>
        </div>
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
        <Store size={18} className="text-emerald-300" />
        <div>
          <h1 className="font-mono text-lg tracking-[0.2em] text-dizajno-text">
            SUPPLIER PORTAL
          </h1>
          <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Pick a supplier to manage
          </p>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-8 py-10">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {memberships.map((m) => (
            <li key={m.supplierId}>
              <Link
                href={
                  m.isSuspended
                    ? "#"
                    : `/supplier/${m.supplierId}/products`
                }
                onClick={(e) => {
                  if (m.isSuspended) e.preventDefault();
                }}
                className={`block rounded border px-4 py-4 transition ${
                  m.isSuspended
                    ? "border-red-500/30 bg-red-500/5 text-dizajno-muted cursor-not-allowed"
                    : "border-white/10 bg-black/30 hover:bg-black/50 hover:border-white/20 text-dizajno-text"
                }`}
              >
                <p className="font-mono text-sm truncate">{m.supplierName}</p>
                <p className="font-mono text-[10px] tracking-widest uppercase mt-1 text-dizajno-muted">
                  /{m.supplierSlug} · {m.role}
                  {m.isSuspended ? " · Suspended" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
