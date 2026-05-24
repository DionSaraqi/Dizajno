"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, Lock, Mail } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import AuthShell from "@/components/auth/AuthShell";
import { Button, FormField, Input } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/projects";

  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);
  const storeError = useAuthStore((s) => s.error);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(redirect);
    }
  }, [status, redirect, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "Login failed. Check your credentials.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const errorMessage = localError ?? storeError;
  const registerHref =
    redirect && redirect !== "/projects"
      ? `/register?redirect=${encodeURIComponent(redirect)}`
      : "/register";

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back."
      subtitle="Pick up your projects, browse the catalog, or respond to quote requests from your inbox."
      footer={
        <>
          New to Dizajno?{" "}
          <Link
            href={registerHref}
            className="text-dizajno-text font-medium hover:text-dizajno-accent transition-colors"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@studio.com"
            leftIcon={<Mail />}
          />
        </FormField>

        <FormField
          label="Password"
          htmlFor="password"
          rightLabel={
            <Link
              href="#"
              className="text-dizajno-muted hover:text-dizajno-text transition-colors"
            >
              Forgot?
            </Link>
          }
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            leftIcon={<Lock />}
          />
        </FormField>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-dizajno-danger/30 bg-dizajno-danger-soft px-3 py-2.5 text-[13px] text-dizajno-danger"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          rightIcon={!submitting ? <ArrowRight /> : undefined}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-dizajno-border flex items-center justify-between text-[12.5px] text-dizajno-muted">
        <span>Demo account</span>
        <button
          type="button"
          onClick={() => {
            setEmail("admin@dizajno.local");
            setPassword("Admin1234!");
          }}
          className="font-mono text-dizajno-text-subtle hover:text-dizajno-text underline-offset-2 hover:underline transition-colors"
        >
          admin@dizajno.local
        </button>
      </div>
    </AuthShell>
  );
}
