"use client";

import { useEffect } from "react";

/**
 * Top-level error boundary for failures in the root layout itself (where the
 * normal error.tsx can't render). Must supply its own <html>/<body>. Kept
 * dependency-free and inline-styled so it works even if app CSS failed to load.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>
          Something went wrong
        </h1>
        <p style={{ color: "#555", maxWidth: "28rem" }}>
          Sorry — the page failed to load. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            borderRadius: "0.375rem",
            background: "#111",
            color: "#fff",
            border: "none",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
