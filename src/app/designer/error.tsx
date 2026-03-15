"use client";

import { useEffect } from "react";

export default function DesignerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Designer error:", error);
  }, [error]);

  return (
    <div className="w-full h-screen flex items-center justify-center bg-dizajno-bg">
      <div className="max-w-md w-full mx-4 p-6 bg-dizajno-surface border border-dizajno-border rounded-xl text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-dizajno-danger/10 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-dizajno-danger"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-dizajno-text mb-2">
          Something went wrong
        </h2>

        <p className="text-sm text-dizajno-muted mb-6">
          {error.message || "An unexpected error occurred in the designer."}
        </p>

        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium rounded-md bg-dizajno-accent hover:bg-dizajno-accent-hover text-white transition-colors focus:outline-none focus:ring-2 focus:ring-dizajno-accent/50"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
