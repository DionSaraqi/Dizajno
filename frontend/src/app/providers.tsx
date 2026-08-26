"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

import SessionExpiredBanner from "@/components/auth/SessionExpiredBanner";
import { toNormalizedError } from "@/lib/apiError";
import { toastApiError } from "@/lib/errorToast";
import { useAuthStore } from "@/store/useAuthStore";

interface ProvidersProps {
  children: React.ReactNode;
}

function AuthBootstrap(): null {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status === "idle") {
      void bootstrap();
    }
  }, [status, bootstrap]);
  return null;
}

/**
 * Retrying a 4xx just delays a failure the server has already decided on, and
 * doubles the latency before the user sees it. Only transport failures, 5xx,
 * and the two "come back later" statuses are worth another attempt.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  const { kind } = toNormalizedError(error);
  return kind === "network" || kind === "server" || kind === "unavailable" || kind === "rate-limit";
}

export function Providers({ children }: ProvidersProps) {
  // One QueryClient per browser session — stored in state so HMR doesn't recreate it
  // (and so React strict-mode double-render in dev doesn't either).
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            // An expired session already has a banner; a toast per failed query
            // on top of it would be a pile-up saying the same thing.
            if (toNormalizedError(error).kind === "session-expired") return;
            if (query.meta?.errorHandled) return;

            // A first load that fails has no content to protect, so the screen
            // renders its own inline error state — a toast would duplicate it.
            // A *refetch* that fails is different: stale content is still on
            // screen looking current, and nothing else would say otherwise.
            if (query.state.data === undefined) return;

            toastApiError(error, {
              action: "refresh this view",
              // Keyed by query, so a 30s poll against a down backend replaces
              // its own toast instead of stacking one every 30 seconds.
              id: `query-refetch:${query.queryHash}`,
            });
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (toNormalizedError(error).kind === "session-expired") return;
            // Opt-out for the mutations that render their own inline error.
            // Default-on so a new mutation can never fail silently: before this,
            // 12 of them swallowed failures entirely.
            if (mutation.meta?.errorHandled) return;
            toastApiError(error);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: shouldRetry,
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <AuthBootstrap />
      {children}
      <SessionExpiredBanner />
      <Toaster richColors closeButton position="top-right" />
    </QueryClientProvider>
  );
}
