"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-level error boundary. Catches unexpected errors thrown while rendering
 * a route segment or running a server action so the guest sees a branded
 * fallback with a retry instead of Next's bare "Application error" screen.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error to the server logs (and any attached error tracker).
    // Replace with your reporter (e.g. Sentry.captureException) once wired up.
    console.error("[route error]", error);
  }, [error]);

  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        Sorry — an unexpected error occurred. Please try again, and if it keeps
        happening, contact us and we&apos;ll help right away.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Try again
        </button>
        <Link href="/" className="text-sm underline">
          Back to home
        </Link>
      </div>
    </main>
  );
}
