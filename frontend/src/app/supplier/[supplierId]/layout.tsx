"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import {
  Boxes,
  Briefcase,
  Inbox,
  Palette,
  Settings,
  ShieldAlert,
  Store,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Badge, Button, EmptyState, TopBar } from "@/components/ui";

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
  const logout = useAuthStore((s) => s.logout);

  const membership = user?.supplierMemberships.find(
    (m) => m.supplierId === params.supplierId,
  );
  const isOwner = membership?.role === "Owner";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(
        `/login?redirect=${encodeURIComponent(pathname ?? "/supplier")}`,
      );
    }
  }, [status, pathname, router]);

  if (status !== "authenticated" || !user) {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg">
        <p className="text-sm text-dizajno-muted">Loading…</p>
      </main>
    );
  }

  if (!membership) {
    return (
      <div className="min-h-screen w-screen bg-dizajno-bg">
        <TopBar
          user={{ displayName: user.displayName, email: user.email }}
          onSignOut={async () => {
            await logout();
            router.push("/");
          }}
        />
        <div className="max-w-2xl mx-auto px-6 py-16">
          <EmptyState
            icon={<Briefcase />}
            title="You're not a member of this supplier"
            description="The supplier portal is only available to invited members. Pick a different supplier or contact the supplier's owner."
            action={
              <Link href="/supplier">
                <Button variant="secondary">Pick a supplier</Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (membership.isSuspended) {
    return (
      <div className="min-h-screen w-screen bg-dizajno-bg">
        <TopBar
          user={{ displayName: user.displayName, email: user.email }}
          onSignOut={async () => {
            await logout();
            router.push("/");
          }}
        />
        <div className="max-w-2xl mx-auto px-6 py-16">
          <div className="rounded-2xl border border-dizajno-danger/30 bg-dizajno-danger-soft p-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-dizajno-danger/10 text-dizajno-danger flex items-center justify-center mb-4">
              <ShieldAlert size={22} />
            </div>
            <h2 className="text-[17px] font-semibold text-dizajno-text">
              {membership.supplierName} is suspended
            </h2>
            <p className="mt-2 text-[13.5px] text-dizajno-text-subtle max-w-md mx-auto leading-relaxed">
              The platform admin has temporarily disabled this supplier&apos;s
              portal. Catalog edits, members, and quote responses are locked
              until access is restored.
            </p>
            <div className="mt-6">
              <Link href="/supplier">
                <Button variant="secondary">Pick another supplier</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const supplierId = params.supplierId;
  const baseTabs = [
    {
      href: `/supplier/${supplierId}/products`,
      label: "Products",
      icon: Boxes,
    },
    {
      href: `/supplier/${supplierId}/textures`,
      label: "Textures",
      icon: Palette,
    },
    { href: "/supplier/quotes", label: "Quote inbox", icon: Inbox },
  ];
  const ownerTabs = [
    {
      href: `/supplier/${supplierId}/members`,
      label: "Members",
      icon: Users,
    },
    {
      href: `/supplier/${supplierId}/profile`,
      label: "Profile",
      icon: Settings,
    },
  ];
  const tabs = isOwner ? [...baseTabs, ...ownerTabs] : baseTabs;

  return (
    <div className="min-h-screen w-screen bg-dizajno-bg">
      <TopBar
        contextChip={
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-dizajno-accent-soft text-dizajno-accent flex items-center justify-center shrink-0">
              <Store size={13} />
            </div>
            <Link
              href="/supplier"
              className="text-[13px] font-medium text-dizajno-text truncate hover:text-dizajno-accent transition-colors"
            >
              {membership.supplierName}
            </Link>
            <Badge tone={membership.role === "Owner" ? "accent" : "neutral"} size="sm">
              {membership.role}
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
          {tabs.map((tab) => {
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
