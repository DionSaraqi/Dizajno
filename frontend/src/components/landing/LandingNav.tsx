"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, LogIn } from "lucide-react";
import { buildNavItems, type NavItem } from "@/components/landing/navItems";
import { useSessionChrome } from "@/hooks/useSessionChrome";
import NewProjectDialog from "@/components/projects/NewProjectDialog";
import { Skeleton } from "@/components/ui";

/**
 * Left "drawing index" navigation. The sign-in affordance below it is only for
 * anonymous visitors — once signed in, identity lives in the top-right meta row
 * (see LandingHeader) so there's exactly one account indicator on the page.
 */
export default function LandingNav() {
  const router = useRouter();
  const session = useSessionChrome();
  const [createOpen, setCreateOpen] = useState(false);

  const items = buildNavItems(session.state);

  function handleClick(item: NavItem): void {
    if (!item.enabled) return;
    if (item.opens === "new-project") {
      setCreateOpen(true);
      return;
    }
    router.push(item.href);
  }

  return (
    <nav className="absolute top-1/2 left-10 -translate-y-1/2 z-10 w-[290px]">
      <div
        className="mb-5 flex items-center gap-3 animate-slide-up"
        style={{ animationDelay: "160ms", animationFillMode: "backwards" }}
      >
        <span className="font-mono text-[10px] uppercase tracking-label text-dizajno-muted">
          Index
        </span>
        <span className="flex-1 h-px bg-dizajno-border" />
        <span className="font-mono text-[10px] uppercase tracking-label text-dizajno-muted-subtle">
          05
        </span>
      </div>

      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li
            key={item.num}
            className="animate-slide-up"
            style={{
              animationDelay: `${200 + i * 55}ms`,
              animationFillMode: "backwards",
            }}
          >
            <NavRow item={item} onClick={() => handleClick(item)} />
          </li>
        ))}
      </ul>

      {/* Anonymous only — signed-in identity lives in the top-right meta row. */}
      {session.isAnonymous && (
        <div
          className="mt-5 pt-5 border-t border-dizajno-border animate-slide-up"
          style={{ animationDelay: "520ms", animationFillMode: "backwards" }}
        >
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="group inline-flex items-center gap-2 text-[13px] font-medium text-dizajno-text-subtle hover:text-dizajno-text transition-colors"
          >
            <LogIn size={14} strokeWidth={1.75} />
            <span>Sign in</span>
            <ArrowUpRight
              size={12}
              strokeWidth={2}
              className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-dizajno-accent transition-all duration-200"
            />
          </button>
        </div>
      )}

      <NewProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </nav>
  );
}

function NavRow({ item, onClick }: { item: NavItem; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!item.enabled}
      className={[
        "group relative w-full flex items-center gap-3 px-3 py-2.5 -mx-3 rounded-lg text-left",
        "transition-all duration-200 ease-out",
        item.enabled
          ? "cursor-pointer hover:bg-white hover:shadow-card-sm"
          : "cursor-default opacity-55",
      ].join(" ")}
    >
      <span className="w-6 font-mono text-[10.5px] tracking-label text-dizajno-muted-subtle group-hover:text-dizajno-accent transition-colors">
        {item.num}
      </span>

      <span
        className={[
          "flex h-7 w-7 items-center justify-center rounded-md border transition-all",
          item.enabled
            ? "border-dizajno-border bg-white/60 text-dizajno-text-subtle group-hover:border-dizajno-accent/30 group-hover:bg-dizajno-accent-soft group-hover:text-dizajno-accent"
            : "border-dizajno-border-subtle bg-transparent text-dizajno-muted-subtle",
        ].join(" ")}
      >
        <Icon size={14} strokeWidth={1.5} />
      </span>

      <span className="flex-1 min-w-0 leading-snug">
        {item.loading ? (
          <Skeleton className="h-3 w-[6.5rem]" />
        ) : (
          <span
            className={[
              "text-[13.5px] font-medium tracking-tight transition-colors",
              item.enabled ? "text-dizajno-text" : "text-dizajno-text-subtle",
            ].join(" ")}
          >
            {item.label}
          </span>
        )}
      </span>

      {item.loading ? null : item.enabled ? (
        <ArrowUpRight
          size={14}
          strokeWidth={1.75}
          className="text-dizajno-muted-subtle opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-dizajno-accent transition-all duration-200"
        />
      ) : (
        <span className="font-mono text-[9px] uppercase tracking-label text-dizajno-muted-subtle">
          Soon
        </span>
      )}
    </button>
  );
}
