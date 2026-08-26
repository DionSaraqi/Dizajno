"use client";

import { useEffect } from "react";

import RouteErrorScreen from "@/components/errors/RouteErrorScreen";

export default function ProjectDesignerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Project designer error:", error);
  }, [error]);

  return (
    <RouteErrorScreen
      error={error}
      reset={reset}
      surface="The designer"
      homeHref="/projects"
      homeLabel="Back to projects"
    />
  );
}
