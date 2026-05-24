"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ScrollText, ShieldCheck, Sparkles, Store } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Badge, Spinner, TopBar } from "@/components/ui";

const TABS = [
  { href: "/admin/suppliers", label: "Suppliers", icon: Store },
  { href: "/admin/moderation", label: "Moderation", icon: Sparkles },
  { href: "/admin/audit-log", label: "Audit log", icon: ScrollText },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const isAdmin = user?.roles.includes("Admin") ?? false;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(
        `/login?redirect=${encodeURIComponent(pathname ?? "/admin")}`,
      );
    } else if (status === "authenticated" && !isAdmin) {
      router.replace("/projects");
    }
  }, [status, isAdmin, pathname, router]);

  if (status !== "authenticated" || !isAdmin || !user) {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg">
        <div className="flex items-center gap-2 text-dizajno-muted text-sm">
          <Spinner /> Loading admin…
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-dizajno-bg">
      <TopBar
        contextChip={
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-dizajno-warning-soft text-dizajno-warning flex items-center justify-center shrink-0">
              <ShieldCheck size={13} />
            </div>
            <span className="text-[13px] font-medium text-dizajno-text truncate">
              Admin
            </span>
            <Badge tone="warning" size="sm">
              Platform staff
            </Badge>
          </div>
        }
        user={{ displayName: user.displayName, email: user.email }}
        onSignOut={async () => {
          await logout();
          router.push("/");
        }}
        userMenu={
          <Link
            href="/projects"
            className="block w-full px-4 py-1.5 text-[13px] text-dizajno-text-subtle hover:bg-dizajno-elevated hover:text-dizajno-text transition-colors"
          >
            Back to projects
          </Link>
        }
        flush
      />

      <nav className="sticky top-14 z-20 bg-dizajno-bg/85 backdrop-blur-md border-b border-dizajno-border">
        <div className="px-6 flex items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const active = pathname?.startsWith(tab.href) ?? false;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={[
                  "relative inline-flex items-center gap-1.5 h-11 px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                  active
                    ? "text-dizajno-text"
                    : "text-dizajno-muted hover:text-dizajno-text",
                ].join(" ")}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {active && (
                  <span className="absolute left-3 right-3 -bottom-px h-px bg-dizajno-text" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6">{children}</div>
    </div>
  );
}
