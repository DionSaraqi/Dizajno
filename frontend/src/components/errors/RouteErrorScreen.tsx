"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { Alert, Button } from "@/components/ui";

export interface RouteErrorScreenProps {
  /** The value React handed the boundary. */
  error: Error & { digest?: string };
  /** Next's boundary reset — re-renders the segment. */
  reset?: () => void;
  /** Names the surface that failed, e.g. "the designer". */
  surface?: string;
  /** Where "Leave this page" should go. */
  homeHref?: string;
  homeLabel?: string;
}

/**
 * Whole-route failure screen for a `error.tsx` boundary.
 *
 * A React render throw carries a *developer* message ("Cannot read properties
 * of undefined") — meaningless to a user and occasionally revealing. So the
 * visible copy is written, and the real message plus Next's `digest` go into
 * the console always and the collapsed disclosure outside production.
 */
export default function RouteErrorScreen({
  error,
  reset,
  surface,
  homeHref = "/projects",
  homeLabel = "Go to projects",
}: RouteErrorScreenProps) {
  const technical = [error.message, error.digest && `digest: ${error.digest}`]
    .filter(Boolean)
    .join("\n");

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-dizajno-bg px-6">
      <div className="w-full max-w-md">
        <Alert
          tone="danger"
          title={surface ? `${surface} stopped responding` : "This page stopped responding"}
          technical={technical || undefined}
          action={
            <>
              {reset && (
                <Button size="sm" variant="secondary" leftIcon={<RefreshCw />} onClick={reset}>
                  Try again
                </Button>
              )}
              <Link href={homeHref}>
                <Button size="sm" variant="ghost">
                  {homeLabel}
                </Button>
              </Link>
            </>
          }
        >
          Something broke while rendering this page. Trying again reloads just
          this part of the app — it usually works.
        </Alert>
      </div>
    </main>
  );
}
