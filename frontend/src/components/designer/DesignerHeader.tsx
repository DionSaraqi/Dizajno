"use client";

import Link from "next/link";
import React from "react";
import { ArrowLeft, Briefcase, FolderOpen, LogIn, ShieldCheck } from "lucide-react";
import {
  AccountMenu,
  AccountMenuLink,
  Button,
  Logo,
  Skeleton,
} from "@/components/ui";
import { useSessionChrome } from "@/hooks/useSessionChrome";

export interface DesignerHeaderProps {
  /** Renders a back arrow to this route. Omit for no back button. */
  backHref?: string;
  /** Accessible label for the back arrow. */
  backLabel?: string;
  /** Where the wordmark links. */
  homeHref?: string;
  /** Document title — project name, or what this scene is. */
  title: React.ReactNode;
  /** Status chip beside the title (save state, access mode). */
  badge?: React.ReactNode;
  /** Buttons rendered before the account slot. */
  actions?: React.ReactNode;
  /** Anonymous-visitor call to action. Omit to show a plain "Sign in". */
  signInCta?: { label: string; href: string };
}

/**
 * Document + identity bar shared by all three designer surfaces (/designer,
 * /projects/[id], /share/[token]). Keeps the Toolbar underneath purely about
 * tools, and guarantees the three read identically.
 *
 * Same palette and border as TopBar so it's recognisably the app's top bar,
 * but h-12/px-4 rather than h-14/px-6 — canvas height is scarce on a tool
 * surface and the existing designer headers already used that density.
 */
export default function DesignerHeader({
  backHref,
  backLabel = "Back",
  homeHref = "/",
  title,
  badge,
  actions,
  signInCta,
}: DesignerHeaderProps) {
  return (
    <header className="flex items-center gap-3 px-4 h-12 shrink-0 border-b border-dizajno-border bg-dizajno-bg/85 backdrop-blur-md">
      {backHref && (
        <>
          <Link
            href={backHref}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-dizajno-muted hover:text-dizajno-text hover:bg-dizajno-elevated transition-colors"
            aria-label={backLabel}
          >
            <ArrowLeft size={15} />
          </Link>
          <div className="w-px h-5 bg-dizajno-border" />
        </>
      )}

      <Link
        href={homeHref}
        className="inline-flex items-center gap-1.5 shrink-0 text-dizajno-text"
        aria-label="Dizajno"
      >
        <Logo size={18} />
      </Link>

      <div className="flex-1 min-w-0 flex items-baseline gap-2">
        <span className="text-[13.5px] font-medium text-dizajno-text truncate">
          {title}
        </span>
        {badge}
      </div>

      {actions}

      <SessionSlot signInCta={signInCta} />
    </header>
  );
}

/**
 * Sign-out deliberately doesn't navigate: pages with an auth gate
 * (/projects/[id]) already redirect themselves on `unauthenticated`, and the
 * ones without (/designer, /share/[token]) are usable signed-out — pushing a
 * route from here would throw away an unsaved sketch.
 */
function SessionSlot({ signInCta }: { signInCta?: { label: string; href: string } }) {
  const session = useSessionChrome();

  if (session.isPending) {
    return <Skeleton className="h-8 w-8 rounded-lg" />;
  }

  if (session.isAuthed && session.user) {
    return (
      <AccountMenu
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
    <Link href={signInCta?.href ?? "/login"}>
      <Button variant="ghost" size="sm" leftIcon={<LogIn />}>
        {signInCta?.label ?? "Sign in"}
      </Button>
    </Link>
  );
}
