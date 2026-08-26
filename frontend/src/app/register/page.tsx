"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock, Mail, User } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import AuthShell from "@/components/auth/AuthShell";
import { Button, ErrorSummary, FormField, Input } from "@/components/ui";
import { fieldErrorFor } from "@/lib/apiError";
import { safeRedirect } from "@/utils/safeRedirect";

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
  // Never hand an unvalidated query value to router.replace — see safeRedirect.
  const redirect = safeRedirect(params.get("redirect"), "/projects");
  const status = useAuthStore((s) => s.status);
  const register = useAuthStore((s) => s.register);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
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
      await register(email, password, displayName.trim() || null);
    } catch (caught) {
      // Identity returns an array of human messages ("Email 'x' is already
      // taken."); the model-validation 400 returns a per-field map. Keeping the
      // thrown value lets the summary route each one to the right input.
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  const loginHref =
    redirect && redirect !== "/projects"
      ? `/login?redirect=${encodeURIComponent(redirect)}`
      : "/login";

  // Live password strength indicator
  const checks = {
    length: password.length >= 8,
    digit: /\d/.test(password),
    upper: /[A-Z]/.test(password),
  };
  const strength = Object.values(checks).filter(Boolean).length;

  return (
    <AuthShell
      eyebrow="Create account"
      title="Start designing."
      subtitle="Save your rooms, source from real suppliers, and request quotes — all in one place."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={loginHref}
            className="text-dizajno-text font-medium hover:text-dizajno-accent transition-colors"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Summary first, so a failed submit announces itself and links to the
            fields that need fixing rather than burying the reason. */}
        <ErrorSummary
          error={error}
          action="create your account"
          fieldIds={{ email: "email", password: "password", displayName: "displayName" }}
        />

        <FormField
          label="Display name"
          htmlFor="displayName"
          hint="Optional"
          error={fieldErrorFor(error, "displayName")}
        >
          <Input
            id="displayName"
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Dion Saraqi"
            leftIcon={<User />}
          />
        </FormField>

        <FormField
          label="Email"
          htmlFor="email"
          required
          error={fieldErrorFor(error, "email")}
        >
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
          required
          hint={
            password.length === 0 ? "8+ characters with a digit and an uppercase letter" : undefined
          }
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            leftIcon={<Lock />}
          />
          {password.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex gap-1 flex-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={[
                      "h-1 flex-1 rounded-full transition-colors",
                      i < strength
                        ? strength === 3
                          ? "bg-dizajno-success"
                          : strength === 2
                            ? "bg-dizajno-warning"
                            : "bg-dizajno-danger"
                        : "bg-dizajno-elevated",
                    ].join(" ")}
                  />
                ))}
              </div>
              <span className="text-[11px] text-dizajno-muted tabular-nums">
                {strength === 3 ? "Strong" : strength === 2 ? "Fair" : "Weak"}
              </span>
            </div>
          )}
        </FormField>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          rightIcon={!submitting ? <ArrowRight /> : undefined}
        >
          {submitting ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-[12px] text-dizajno-muted text-center leading-relaxed pt-2">
          By creating an account you agree to our terms and the use of cookies
          for authentication.
        </p>
      </form>
    </AuthShell>
  );
}
