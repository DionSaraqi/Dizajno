"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/projects";
  const status = useAuthStore((s) => s.status);
  const register = useAuthStore((s) => s.register);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(redirect);
    }
  }, [status, redirect, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, displayName.trim() || null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed. Password must be 8+ chars with a digit and an uppercase letter."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen w-screen flex items-center justify-center bg-dizajno-bg blueprint-grid">
      <div className="w-full max-w-sm rounded-lg border border-white/10 bg-black/40 backdrop-blur p-8 shadow-2xl">
        <h1 className="font-mono text-2xl tracking-[0.2em] text-dizajno-text mb-1">
          DIZAJNO
        </h1>
        <p className="font-mono text-xs text-dizajno-muted tracking-wider mb-6">
          create an account
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] tracking-widest text-dizajno-muted uppercase">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-dizajno-text focus:border-white/40 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] tracking-widest text-dizajno-muted uppercase">
              Display name (optional)
            </span>
            <input
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-dizajno-text focus:border-white/40 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] tracking-widest text-dizajno-muted uppercase">
              Password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-dizajno-text focus:border-white/40 focus:outline-none"
            />
            <span className="font-mono text-[10px] text-dizajno-muted/70 mt-1">
              8+ chars, one digit, one uppercase letter
            </span>
          </label>

          {error && (
            <p className="font-mono text-[11px] text-red-400 break-words">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed py-2 font-mono text-sm tracking-wider text-dizajno-text transition"
          >
            {submitting ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 font-mono text-[11px] text-dizajno-muted">
          Already have an account?{" "}
          <Link
            href={
              redirect && redirect !== "/projects"
                ? `/login?redirect=${encodeURIComponent(redirect)}`
                : "/login"
            }
            className="text-dizajno-text underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
