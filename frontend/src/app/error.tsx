"use client";

import { useEffect } from "react";

import RouteErrorScreen from "@/components/errors/RouteErrorScreen";

/**
 * Root boundary. Catches render throws on every route that doesn't define its
 * own `error.tsx` — before this, those fell through to Next's default, which is
 * a blank page in production.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Unhandled page error:", error);
  }, [error]);

  return <RouteErrorScreen error={error} reset={reset} />;
}
