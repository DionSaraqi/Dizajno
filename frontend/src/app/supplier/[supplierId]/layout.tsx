"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  Briefcase,
  Palette,
  Settings,
  Store,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Per-supplier portal shell. Guards three things:
 *   1. Authenticated user.
 *   2. Active membership in the URL supplierId (no soft-fail on suspended).
 *   3. Owner-only tabs (Members, Profile) are hidden from Staff entirely.
 *
 * Suspended members hit a polite block screen — the suspension side-effects
 * on the API would 403 every fetch anyway, but failing closed in the UI is
 * less jarring than empty data.
 */
export default function SupplierPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ supplierId: string }>();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  const membership = user?.supplierMemberships.find(
    (m) => m.supplierId === params.supplierId
  );
  const isOwner = membership?.role === "Owner";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?redirect=${encodeURIComponent(pathname ?? "/supplier")}`);
    }
  }, [status, pathname, router]);

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg blueprint-grid">
        <p className="font-mono text-sm text-dizajno-muted tracking-wider">Loading…</p>
      </main>
    );
  }

  if (!membership) {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg blueprint-grid px-4">
        <div className="max-w-md text-center space-y-3 rounded border border-white/15 bg-black/40 backdrop-blur px-8 py-10">
          <Briefcase size={28} className="mx-auto text-dizajno-muted" />
          <p className="font-mono text-sm text-dizajno-muted">
            You&apos;re not a member of this supplier.
          </p>
          <Link
            href="/supplier"
            className="inline-block rounded border border-white/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text transition"
          >
            Pick a supplier
          </Link>
        </div>
      </main>
    );
  }

  if (membership.isSuspended) {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg blueprint-grid px-4">
        <div className="max-w-md text-center space-y-3 rounded border border-red-500/40 bg-red-500/10 backdrop-blur px-8 py-10">
          <Briefcase size={28} className="mx-auto text-red-400" />
          <p className="font-mono text-sm text-red-300">
            {membership.supplierName} is currently suspended.
          </p>
          <p className="font-mono text-xs text-dizajno-muted">
            Contact the platform admin to restore access.
          </p>
          <Link
            href="/supplier"
            className="inline-block rounded border border-white/10 px-3 py-1.5 font-mono text-xs tracking-widest uppercase text-dizajno-muted hover:text-dizajno-text transition"
          >
            Pick another supplier
          </Link>
        </div>
      </main>
    );
  }

  const supplierId = params.supplierId;
  const baseTabs = [
    { href: `/supplier/${supplierId}/products`, label: "Products", icon: Boxes },
    { href: `/supplier/${supplierId}/textures`, label: "Textures", icon: Palette },
    { href: "/supplier/quotes", label: "Quote inbox", icon: Briefcase },
  ];
  const ownerTabs = [
    { href: `/supplier/${supplierId}/members`, label: "Members", icon: Users },
    { href: `/supplier/${supplierId}/profile`, label: "Profile", icon: Settings },
  ];
  const tabs = isOwner ? [...baseTabs, ...ownerTabs] : baseTabs;

  return (
    <main className="min-h-screen w-screen bg-dizajno-bg blueprint-grid">
      <header className="flex items-center gap-4 px-8 py-5 border-b border-white/10 backdrop-blur">
        <Link
          href="/supplier"
          className="text-dizajno-muted hover:text-dizajno-text transition"
          aria-label="Pick another supplier"
        >
          <ArrowLeft size={18} />
        </Link>
        <Store size={18} className="text-emerald-300" />
        <div className="min-w-0">
          <h1 className="font-mono text-lg tracking-[0.2em] text-dizajno-text truncate">
            {membership.supplierName.toUpperCase()}
          </h1>
          <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            /{membership.supplierSlug} · {membership.role}
          </p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 px-8 py-3 border-b border-white/10">
        {tabs.map((tab) => {
          const active = pathname?.startsWith(tab.href) ?? false;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 rounded border px-3 py-1.5 font-mono text-xs tracking-widest uppercase transition ${
                active
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 text-dizajno-muted hover:text-dizajno-text hover:border-white/20"
              }`}
            >
              <Icon size={12} />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <section className="max-w-6xl mx-auto px-8 py-8">{children}</section>
    </main>
  );
}
