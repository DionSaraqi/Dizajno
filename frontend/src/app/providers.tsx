"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

export function Providers({ children }: ProvidersProps) {
  // One QueryClient per browser session — stored in state so HMR doesn't recreate it
  // (and so React strict-mode double-render in dev doesn't either).
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <AuthBootstrap />
      {children}
    </QueryClientProvider>
  );
}
