import {
  BookOpen,
  FolderOpen,
  HelpCircle,
  PlusSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { SessionState } from "@/hooks/useSessionChrome";

export type NavItem = {
  num: string;
  icon: LucideIcon;
  label: string;
  href: string;
  enabled: boolean;
  /**
   * When set, clicking opens that dialog instead of routing to `href`.
   * `href` is still used for prefetching the eventual destination.
   */
  opens?: "new-project";
  /**
   * True while the session is still resolving, so the row renders a placeholder
   * label instead of committing to wording that may be about to change.
   */
  loading?: boolean;
};

/**
 * Left "drawing index" navigation for the landing page.
 *
 * Row 01 is session-dependent: signed-in visitors get the same name-it-and-go
 * project creation as the projects page, while anonymous visitors go straight
 * into the throwaway designer. During `pending` its label is a placeholder —
 * committing to either wording and then swapping it is a visible flicker.
 */
export function buildNavItems(session: SessionState): NavItem[] {
  const authed = session === "authed";
  const pending = session === "pending";

  return [
    {
      num: "01",
      icon: PlusSquare,
      label: authed ? "New project" : "New design",
      href: authed ? "/projects" : "/designer",
      enabled: !pending,
      opens: authed ? "new-project" : undefined,
      loading: pending,
    },
    {
      num: "02",
      icon: FolderOpen,
      label: "My projects",
      // Anonymous visitors skip the projects page's own redirect hop.
      href: session === "anonymous" ? "/login?redirect=/projects" : "/projects",
      enabled: true,
    },
    { num: "03", icon: BookOpen, label: "Templates", href: "#", enabled: false },
    { num: "04", icon: Settings, label: "Settings", href: "#", enabled: false },
    { num: "05", icon: HelpCircle, label: "Help & docs", href: "#", enabled: false },
  ];
}
