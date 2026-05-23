"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, ScrollText, Sparkles, Store } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

const TABS = [
  { href: "/admin/suppliers", label: "Suppliers", icon: Store },
  { href: "/admin/moderation", label: "Moderation", icon: Sparkles },
  { href: "/admin/audit-log", label: "Audit log", icon: ScrollText },
];

/**
 * Layout shared by every /admin/* route. Forces the caller to be authed with
 * the Admin role; non-admins bounce to /login. The tab strip lives here so
 * each inner page can focus on its own view.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  const isAdmin = user?.roles.includes("Admin") ?? false;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?redirect=${encodeURIComponent(pathname ?? "/admin")}`);
    } else if (status === "authenticated" && !isAdmin) {
      router.replace("/projects");
    }
  }, [status, isAdmin, pathname, router]);

  if (status !== "authenticated" || !isAdmin) {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg blueprint-grid">
        <p className="font-mono text-sm text-dizajno-muted tracking-wider">
          {status === "idle" || status === "authenticating" ? "Loading…" : "Redirecting…"}
        </p>
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
        <ShieldCheck size={18} className="text-amber-400" />
        <div>
          <h1 className="font-mono text-lg tracking-[0.2em] text-dizajno-text">
            ADMIN
          </h1>
          <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Suppliers, moderation, audit trail
          </p>
        </div>
      </header>

      <nav className="flex gap-2 px-8 py-3 border-b border-white/10">
        {TABS.map((tab) => {
          const active = pathname?.startsWith(tab.href) ?? false;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 rounded border px-3 py-1.5 font-mono text-xs tracking-widest uppercase transition ${
                active
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
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
