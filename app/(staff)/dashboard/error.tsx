"use client";

import { BackOfficeError } from "@/components/shared/back-office-error";

/** Staff-dashboard error boundary — keeps the sidebar/shell alive and speaks
 * to staff instead of falling through to the guest-branded app/error.tsx. */
export default function DashboardError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BackOfficeError
      {...props}
      home={{ href: "/dashboard", label: "Back to overview" }}
    />
  );
}
