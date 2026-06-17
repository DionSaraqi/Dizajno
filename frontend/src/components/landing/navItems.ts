import {
  BookOpen,
  FolderOpen,
  HelpCircle,
  PlusSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  num: string;
  icon: LucideIcon;
  label: string;
  href: string;
  enabled: boolean;
};

/** Left "drawing index" navigation for the landing page. */
export const navItems: NavItem[] = [
  { num: "01", icon: PlusSquare, label: "New design", href: "/designer", enabled: true },
  { num: "02", icon: FolderOpen, label: "My projects", href: "/projects", enabled: true },
  { num: "03", icon: BookOpen, label: "Templates", href: "#", enabled: false },
  { num: "04", icon: Settings, label: "Settings", href: "#", enabled: false },
  { num: "05", icon: HelpCircle, label: "Help & docs", href: "#", enabled: false },
];
