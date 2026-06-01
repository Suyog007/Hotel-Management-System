"use client";

import { useFormStatus } from "react-dom";

export function ResendBookingOtpButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="block w-full text-center text-xs text-muted-foreground underline transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Sending a fresh code…" : "Didn't get the code? Resend"}
    </button>
  );
}
