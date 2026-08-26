"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import AuthShell from "@/components/auth/AuthShell";
import { Alert, Button, ErrorSummary, FormField, Input } from "@/components/ui";
import { fieldErrorFor } from "@/lib/apiError";
import { safeRedirect } from "@/utils/safeRedirect";

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
  // Never hand an unvalidated query value to router.replace — see safeRedirect.
  const redirect = safeRedirect(params.get("redirect"), "/projects");
  const sessionExpired = params.get("reason") === "session-expired";

  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(redirect);
    }
  }, [status, redirect, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (caught) {
      // The store already normalised this; keep the value, not a string, so
      // the summary can attach per-field messages to the right inputs.
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

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
        {sessionExpired && !error && (
          <Alert tone="info" size="sm" live="status">
            Your session ended, so we signed you out. Sign in to continue where
            you left off.
          </Alert>
        )}

        {/* Summary first: a failed submit must announce itself and offer a way
            to each bad field, rather than hiding the reason below the button. */}
        <ErrorSummary
          error={error}
          action="sign in"
          fieldIds={{ email: "email", password: "password" }}
        />

        <FormField label="Email" htmlFor="email" error={fieldErrorFor(error, "email")}>
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
          error={fieldErrorFor(error, "password")}
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
