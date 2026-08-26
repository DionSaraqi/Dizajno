"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogIn } from "lucide-react";

import { useAuthStore } from "@/store/useAuthStore";
import { Alert, Button } from "@/components/ui";

/**
 * Raised when the refresh cookie is rejected mid-session.
 *
 * Deliberately a banner rather than an automatic redirect: a redirect unmounts
 * whatever the user was doing, and on the designer surfaces that means losing
 * an unsaved scene. This announces the expiry, keeps the page intact, and lets
 * the user leave on their own terms with a redirect back to where they were.
 *
 * Mounted once, in Providers, so every surface inherits it.
 */
export default function SessionExpiredBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const dismiss = useAuthStore((s) => s.dismissSessionExpiry);

  if (!sessionExpired) return null;

  // /login and /register would re-authenticate anyway; a banner there is noise.
  if (pathname === "/login" || pathname === "/register") return null;

  function signIn(): void {
    const target = pathname && pathname !== "/" ? pathname : "/projects";
    dismiss();
    router.push(
      `/login?reason=session-expired&redirect=${encodeURIComponent(target)}`,
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex justify-center px-4">
      <Alert
        tone="warning"
        title="Your session has ended"
        size="sm"
        live="alert"
        className="pointer-events-auto w-full max-w-md shadow-card-lg"
        action={
          <Button size="xs" variant="secondary" leftIcon={<LogIn />} onClick={signIn}>
            Sign in again
          </Button>
        }
      >
        You&rsquo;ve been signed out, so changes won&rsquo;t save. Sign in again to
        pick up where you left off — this page stays as it is.
      </Alert>
    </div>
  );
}
