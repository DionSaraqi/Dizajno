"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Inbox } from "lucide-react";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

const POLL_MS = 30_000;

export default function QuotesListPage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?redirect=/quotes");
    }
  }, [status, router]);

  const quotes = useQuery({
    queryKey: ["quotes", "list"],
    queryFn: () => api.listQuotes(),
    enabled: status === "authenticated",
    refetchInterval: POLL_MS,
  });

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg blueprint-grid">
        <p className="font-mono text-sm text-dizajno-muted tracking-wider">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-screen bg-dizajno-bg blueprint-grid">
      <header className="flex items-center gap-4 px-8 py-5 border-b border-white/10 backdrop-blur">
        <Link
          href="/projects"
          className="text-dizajno-muted hover:text-dizajno-text transition"
          aria-label="Back to projects"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-mono text-lg tracking-[0.2em] text-dizajno-text">
            QUOTES
          </h1>
          <p className="font-mono text-[10px] tracking-widest text-dizajno-muted uppercase">
            Responses from suppliers, all in one place.
          </p>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-8 py-10">
        {quotes.isLoading && (
          <p className="font-mono text-sm text-dizajno-muted">Loading quotes…</p>
        )}
        {quotes.error && (
          <p className="font-mono text-sm text-red-400 break-words">
            Failed to load quotes: {(quotes.error as Error).message}
          </p>
        )}
        {quotes.data && quotes.data.length === 0 && (
          <div className="rounded border border-white/10 bg-black/30 px-6 py-10 text-center">
            <Inbox size={32} className="mx-auto text-dizajno-muted/60 mb-3" />
            <p className="font-mono text-sm text-dizajno-muted">
              No quotes yet. Open a project, design a room, then click{" "}
              <span className="text-dizajno-text">Quote</span> in the header.
            </p>
          </div>
        )}

        {quotes.data && quotes.data.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quotes.data.map((quote) => (
              <li
                key={quote.id}
                className="rounded-lg border border-white/10 bg-black/30 hover:bg-black/40 backdrop-blur overflow-hidden transition"
              >
                <Link href={`/quotes/${quote.id}`} className="block aspect-video relative">
                  {quote.projectThumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={quote.projectThumbnailUrl}
                      alt={quote.projectName}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-dizajno-muted font-mono text-xs tracking-widest opacity-50">
                      NO THUMBNAIL
                    </div>
                  )}
                  <StatusPill status={quote.status} />
                </Link>
                <Link
                  href={`/quotes/${quote.id}`}
                  className="block px-4 py-3 border-t border-white/5"
                >
                  <p className="font-mono text-sm text-dizajno-text truncate">
                    {quote.projectName}
                  </p>
                  <p className="font-mono text-[10px] tracking-widest text-dizajno-muted/70 uppercase mt-1">
                    {quote.respondedCount}/{quote.supplierCount} replied
                    {quote.declinedCount > 0 ? ` · ${quote.declinedCount} declined` : ""}
                  </p>
                  <p className="font-mono text-[10px] tracking-widest text-dizajno-muted/50 uppercase mt-0.5">
                    {new Date(quote.createdAt).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatusPill({ status }: { status: api.QuoteStatus }) {
  const colour =
    status === "Open"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : status === "Closed"
        ? "bg-white/10 text-dizajno-muted border-white/20"
        : "bg-red-500/20 text-red-300 border-red-500/40";
  return (
    <span
      className={`absolute top-2 right-2 rounded border px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase ${colour}`}
    >
      {status}
    </span>
  );
}
