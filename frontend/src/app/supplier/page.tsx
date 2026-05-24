"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  TopBar,
  Button,
} from "@/components/ui";

export default function SupplierIndexPage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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

  if (status !== "authenticated" || !user) {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg">
        <p className="text-sm text-dizajno-muted">Loading…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-dizajno-bg">
      <TopBar
        links={[
          { label: "Projects", href: "/projects" },
          { label: "Supplier portal", href: "/supplier", active: true },
        ]}
        user={{ displayName: user.displayName, email: user.email }}
        onSignOut={async () => {
          await logout();
          router.push("/");
        }}
      />

      <div className="max-w-4xl mx-auto px-6">
        <PageHeader
          eyebrow="Supplier portal"
          title="Pick a supplier"
          description="You belong to multiple supplier organisations. Choose one to manage its products, textures, members, and profile."
        />

        <section className="py-8">
          {memberships.length === 0 ? (
            <EmptyState
              icon={<Briefcase />}
              title="No supplier memberships"
              description="Ask an admin or a supplier owner to send you an invite, then come back here."
              action={
                <Link href="/projects">
                  <Button variant="secondary">Back to projects</Button>
                </Link>
              }
            />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {memberships.map((m) => {
                const suspended = m.isSuspended;
                return (
                  <li key={m.supplierId}>
                    <Link
                      href={
                        suspended
                          ? "#"
                          : `/supplier/${m.supplierId}/products`
                      }
                      onClick={(e) => suspended && e.preventDefault()}
                      className={[
                        "group block",
                        suspended ? "cursor-not-allowed" : "",
                      ].join(" ")}
                      aria-disabled={suspended}
                    >
                      <Card
                        flush
                        className={[
                          "p-5 transition-all",
                          suspended
                            ? "opacity-70 border-dizajno-danger/20 bg-dizajno-danger-soft/40"
                            : "hover:shadow-card hover:-translate-y-px",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className={[
                                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                                suspended
                                  ? "bg-dizajno-danger-soft text-dizajno-danger"
                                  : "bg-dizajno-accent-soft text-dizajno-accent",
                              ].join(" ")}
                            >
                              <Store size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14.5px] font-semibold text-dizajno-text truncate">
                                {m.supplierName}
                              </p>
                              <p className="text-[12px] text-dizajno-muted mt-0.5 font-mono">
                                /{m.supplierSlug}
                              </p>
                            </div>
                          </div>
                          {!suspended && (
                            <ChevronRight
                              size={16}
                              className="text-dizajno-muted-subtle group-hover:text-dizajno-text group-hover:translate-x-0.5 transition-all shrink-0 mt-1.5"
                            />
                          )}
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <Badge
                            tone={m.role === "Owner" ? "accent" : "neutral"}
                            dot
                            size="sm"
                          >
                            {m.role}
                          </Badge>
                          {suspended ? (
                            <Badge tone="danger" size="sm">
                              <ShieldAlert size={10} className="mr-1" />
                              Suspended
                            </Badge>
                          ) : (
                            <Badge tone="success" size="sm">
                              <ShieldCheck size={10} className="mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
