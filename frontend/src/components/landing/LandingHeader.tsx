"use client";

import { useRouter } from "next/navigation";
import { Briefcase, FolderOpen, ShieldCheck } from "lucide-react";
import { AccountMenu, AccountMenuLink, Logo, Skeleton } from "@/components/ui";
import { useSessionChrome } from "@/hooks/useSessionChrome";

/** Top-left brand mark + top-right meta/status row. */
export default function LandingHeader() {
  return (
    <>
      <header
        className="absolute top-7 left-10 z-10 flex items-center gap-3 pointer-events-none animate-slide-up"
        style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
      >
        <Logo size={26} />
        <div className="flex flex-col leading-none">
          <span className="text-[17px] font-semibold tracking-tight text-dizajno-text">
            Dizajno
          </span>
          <span className="mt-1.5 font-mono text-[10px] uppercase tracking-label text-dizajno-muted">
            Browser-based room designer
          </span>
        </div>
      </header>

      <div
        className="absolute top-8 right-10 z-20 flex items-center gap-3 font-mono text-[10px] uppercase tracking-label text-dizajno-muted animate-slide-up"
        style={{ animationDelay: "120ms", animationFillMode: "backwards" }}
      >
        <span className="pointer-events-none">v1.0.0</span>
        <Dot />
        <span className="pointer-events-none">24 · 05 · 26</span>
        <Dot />
        <SessionSlot />
      </div>
    </>
  );
}

/**
 * The session indicator. Occupies the slot that used to hold the "Studio
 * online" pill — the row already reads as live status, so it's where the eye
 * goes for it. `pending` renders a placeholder rather than the anonymous pill:
 * `bootstrap()`'s refresh resolves after first paint, so committing to the
 * signed-out state would flash it at every signed-in visitor on a hard load.
 */
function SessionSlot() {
  const router = useRouter();
  const session = useSessionChrome();

  if (session.isPending) {
    return <Skeleton className="h-4 w-[7.5rem] rounded-full" />;
  }

  if (session.isAuthed && session.user) {
    return (
      <AccountMenu
        variant="plan"
        user={{
          displayName: session.user.displayName,
          email: session.user.email,
        }}
        onSignOut={() => void session.signOut()}
        userMenu={
          <>
            <AccountMenuLink href="/projects" icon={<FolderOpen size={14} />}>
              My projects
            </AccountMenuLink>
            {session.hasSupplier && (
              <AccountMenuLink href="/supplier" icon={<Briefcase size={14} />}>
                Supplier portal
              </AccountMenuLink>
            )}
            {session.isAdmin && (
              <AccountMenuLink href="/admin" icon={<ShieldCheck size={14} />}>
                Admin
              </AccountMenuLink>
            )}
          </>
        }
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.push("/login")}
      className="group flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-dizajno-text-subtle hover:text-dizajno-text transition-colors"
    >
      <span className="relative flex w-1.5 h-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-dizajno-success opacity-70 animate-ping" />
        <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-dizajno-success" />
      </span>
      Studio online
    </button>
  );
}

function Dot() {
  return (
    <span
      aria-hidden
      className="inline-block w-1 h-1 rounded-full bg-dizajno-muted-subtle pointer-events-none"
    />
  );
}
