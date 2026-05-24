"use client";

import Link from "next/link";
import { LogOut, ChevronDown } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import Logo from "./Logo";

export interface TopBarLink {
  label: React.ReactNode;
  href: string;
  /** When true, the link is highlighted as active. */
  active?: boolean;
  /** Optional small badge counter. */
  badge?: React.ReactNode;
}

export interface TopBarProps {
  /** Primary navigation items, rendered to the left. */
  links?: TopBarLink[];
  /** Optional context chip rendered next to the logo (e.g. "Acme Furniture" in supplier portal). */
  contextChip?: React.ReactNode;
  /** Right-side actions slot — typically Buttons. Rendered before the user menu. */
  actions?: React.ReactNode;
  /** Display name shown in the user menu. */
  user?: { displayName?: string | null; email: string };
  /** Triggered when the user clicks "Sign out". */
  onSignOut?: () => void;
  /** Optional additional items in the user menu (above the sign out item). */
  userMenu?: React.ReactNode;
  /** Removes the bottom border (e.g. when the page has its own header bar below). */
  flush?: boolean;
}

export default function TopBar({
  links = [],
  contextChip,
  actions,
  user,
  onSignOut,
  userMenu,
  flush = false,
}: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <header
      className={[
        "sticky top-0 z-30 bg-dizajno-bg/85 backdrop-blur-md",
        flush ? "" : "border-b border-dizajno-border",
      ].join(" ")}
    >
      <div className="px-6 h-14 flex items-center gap-5">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 shrink-0"
        >
          <Logo size={22} />
          <span className="text-[15px] font-semibold tracking-tight text-dizajno-text">
            Dizajno
          </span>
        </Link>

        {contextChip && (
          <>
            <span className="text-dizajno-muted-subtle shrink-0">/</span>
            <div className="min-w-0">{contextChip}</div>
          </>
        )}

        {links.length > 0 && (
          <nav className="flex items-center gap-0.5 ml-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "relative inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium transition-colors",
                  link.active
                    ? "text-dizajno-text bg-dizajno-elevated"
                    : "text-dizajno-muted hover:text-dizajno-text hover:bg-dizajno-elevated/60",
                ].join(" ")}
              >
                <span>{link.label}</span>
                {link.badge != null && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10.5px] font-medium tabular-nums bg-dizajno-accent-soft text-dizajno-accent-ink">
                    {link.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {actions}

          {user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="inline-flex items-center gap-2 h-9 pl-1.5 pr-2 rounded-lg border border-transparent hover:border-dizajno-border hover:bg-dizajno-surface transition-colors"
              >
                <Avatar
                  size={26}
                  fallback={
                    (user.displayName?.[0] ?? user.email[0] ?? "U") +
                    (user.displayName?.split(" ")[1]?.[0] ??
                      user.email[1] ??
                      "")
                  }
                  alt={user.displayName ?? user.email}
                />
                <span className="text-[13px] text-dizajno-text-subtle hidden md:inline">
                  {user.displayName || user.email.split("@")[0]}
                </span>
                <ChevronDown
                  size={13}
                  className="text-dizajno-muted hidden md:inline"
                />
              </button>
              {menuOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-dizajno-border bg-dizajno-surface shadow-card-lg overflow-hidden animate-scale-in origin-top-right">
                  <div className="px-4 py-3 border-b border-dizajno-border">
                    {user.displayName && (
                      <div className="text-[13px] font-medium text-dizajno-text truncate">
                        {user.displayName}
                      </div>
                    )}
                    <div className="text-[12px] text-dizajno-muted truncate">
                      {user.email}
                    </div>
                  </div>
                  {userMenu && (
                    <div className="py-1.5 border-b border-dizajno-border">
                      {userMenu}
                    </div>
                  )}
                  <div className="py-1.5">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
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
          )}
        </div>
      </div>
    </header>
  );
}
