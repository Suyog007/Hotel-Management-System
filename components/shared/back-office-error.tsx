"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared error-boundary body for the back office. Unlike the guest-facing
 * `app/error.tsx` ("contact us and we'll help right away"), this speaks to
 * staff: it shows the error digest so whoever reads the server logs can find
 * the matching entry (prod strips the message and leaves only the digest).
 */
export function BackOfficeError({
  error,
  reset,
  home,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  home: { href: string; label: string };
}) {
  useEffect(() => {
    // Surface the error to the server logs (and any attached error tracker).
    // Replace with your reporter (e.g. Sentry.captureException) once wired up.
    console.error("[back-office error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
      <AlertTriangle aria-hidden className="h-8 w-8 text-destructive" />
      <h1 className="text-2xl font-semibold">This page hit an error</h1>
      <p className="text-sm text-muted-foreground">
        The rest of the back office still works. Try again — if it keeps
        failing, note the reference below and check the server logs.
      </p>
      {error.digest && (
        <p className="rounded-md bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground">
          ref: {error.digest}
        </p>
      )}
      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" onClick={reset}>
          Try again
        </Button>
        <a href={home.href} className="text-sm underline">
          {home.label}
        </a>
      </div>
    </div>
  );
}
