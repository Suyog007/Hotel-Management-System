"use client";

import { BackOfficeError } from "@/components/shared/back-office-error";

/** Admin-area error boundary — keeps the sidebar/shell alive and speaks to
 * staff instead of falling through to the guest-branded app/error.tsx. */
export default function AdminError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BackOfficeError
      {...props}
      home={{ href: "/admin/settings", label: "Back to settings" }}
    />
  );
}
