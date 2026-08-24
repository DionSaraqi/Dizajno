"use client";

import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";

export interface AccountMenuProps {
  /** The signed-in user. */
  user: { displayName?: string | null; email: string };
  /** Triggered when the user picks "Sign out". */
  onSignOut?: () => void;
  /** Extra items rendered above the Profile / Sign out group. */
  userMenu?: React.ReactNode;
  /** Which edge the dropdown aligns to. */
  align?: "left" | "right";
  /**
   * Visual skin. `app` matches the TopBar chrome (sentence-case name, filled
   * hover). `plan` matches the landing page's architectural meta row — mono
   * uppercase, hairline border, no filled surface.
   */
  variant?: "app" | "plan";
}

/** Initials for the avatar: first letter of each of the first two name parts. */
function initialsFor(user: AccountMenuProps["user"]): string {
  const parts = user.displayName?.trim().split(/\s+/) ?? [];
  if (parts.length >= 2) return (parts[0][0] ?? "") + (parts[1][0] ?? "");
  if (parts.length === 1 && parts[0].length > 0) return parts[0].slice(0, 2);
  return user.email.slice(0, 2);
}

/**
 * Identity chip + dropdown — the single signed-in indicator for the whole app.
 * Rendered by TopBar, the landing meta row, and DesignerHeader so every surface
 * shows the same thing in the same place (top-right).
 */
export default function AccountMenu({
  user,
  onSignOut,
  userMenu,
  align = "right",
  variant = "app",
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (open && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Esc closes, matching Modal/ContextMenu behaviour.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isPlan = variant === "plan";
  const label = user.displayName || user.email.split("@")[0];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          isPlan
            ? [
                "group inline-flex items-center gap-2 h-7 pl-1 pr-2 rounded-full border transition-colors",
                open
                  ? "border-dizajno-border-strong bg-dizajno-surface"
                  : "border-dizajno-border bg-dizajno-surface/60 hover:border-dizajno-border-strong hover:bg-dizajno-surface",
              ].join(" ")
            : "inline-flex items-center gap-2 h-9 pl-1.5 pr-2 rounded-lg border border-transparent hover:border-dizajno-border hover:bg-dizajno-surface transition-colors"
        }
      >
        <Avatar
          size={isPlan ? 20 : 26}
          fallback={initialsFor(user)}
          alt={user.displayName ?? user.email}
        />
        <span
          className={
            isPlan
              ? "font-mono text-[10px] uppercase tracking-label text-dizajno-text-subtle max-w-[9rem] truncate"
              : "text-[13px] text-dizajno-text-subtle hidden md:inline"
          }
        >
          {label}
        </span>
        <ChevronDown
          size={isPlan ? 11 : 13}
          className={isPlan ? "text-dizajno-muted-subtle" : "text-dizajno-muted hidden md:inline"}
        />
      </button>

      {open && (
        <div
          role="menu"
          className={[
            "absolute top-full mt-2 w-64 rounded-xl border border-dizajno-border bg-dizajno-surface shadow-card-lg overflow-hidden animate-scale-in z-50",
            // The panel owns its typography rather than inheriting it — the
            // landing meta row is mono/uppercase/wide-tracked, and without this
            // the same menu reads differently there than on TopBar pages.
            "font-sans normal-case tracking-normal text-left",
            align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
          ].join(" ")}
        >
          <div className="px-4 py-3 border-b border-dizajno-border">
            {user.displayName && (
              <div className="text-[13px] font-medium text-dizajno-text truncate">
                {user.displayName}
              </div>
            )}
            <div className="text-[12px] text-dizajno-muted truncate">{user.email}</div>
          </div>

          {userMenu && (
            <div className="py-1.5 border-b border-dizajno-border">{userMenu}</div>
          )}

          <div className="py-1.5">
            <AccountMenuLink href="/profile" icon={<User size={14} />} onNavigate={() => setOpen(false)}>
              Profile
            </AccountMenuLink>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut?.();
              }}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-[13px] text-dizajno-text-subtle hover:bg-dizajno-elevated hover:text-dizajno-text transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Link styled to match the menu's own items. Exported so call sites can build
 * their `userMenu` extras without re-deriving the classes.
 */
export function AccountMenuLink({
  href,
  icon,
  children,
  onNavigate,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="w-full flex items-center gap-2 px-4 py-1.5 text-[13px] text-dizajno-text-subtle hover:bg-dizajno-elevated hover:text-dizajno-text transition-colors"
    >
      {icon}
      {children}
    </Link>
  );
}
