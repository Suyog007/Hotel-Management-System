"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Submit button that shows a spinner + custom label while its parent <form>'s
 * server action is pending. Must be rendered inside a <form action={...}>.
 *
 * Use `pendingLabel` to override the spinner text; otherwise "Working…" shows.
 * `disabled` (passed in) is OR'd with the internal pending state so callers
 * can still gate the button on form validity.
 */
type Props = Omit<ButtonProps, "type"> & {
  pendingLabel?: string;
  /** When set, submission asks for confirmation first and aborts on Cancel. */
  confirmMessage?: string;
  children: React.ReactNode;
};

export function SubmitButton({
  children,
  pendingLabel = "Working…",
  confirmMessage,
  disabled,
  onClick,
  ...rest
}: Props) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      onClick={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
