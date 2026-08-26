"use client";

import { useEffect } from "react";

import RouteErrorScreen from "@/components/errors/RouteErrorScreen";

export default function SharedProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Shared project error:", error);
  }, [error]);

  return (
    <RouteErrorScreen
      error={error}
      reset={reset}
      surface="This shared view"
      homeHref="/"
      homeLabel="Back home"
    />
  );
}
