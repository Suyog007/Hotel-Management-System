"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Submit button that shows a spinner + custom label while its parent <form>'s
 * server action is pending. Must be rendered inside a <form action={...}>.
 *
 * Use `pendingLabel` to override the spinner text; otherwise "Working…" shows.
 * `disabled` (passed in) is OR'd with the internal pending state so callers
 * can still gate the button on form validity.
 *
 * When `confirmMessage` is set, clicking opens an in-app ConfirmDialog (not
 * `window.confirm`); confirming submits the form with this button as the
 * submitter, which still runs the form's native validation.
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
  const [confirming, setConfirming] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        ref={btnRef}
        type="submit"
        disabled={pending || disabled}
        onClick={(e) => {
          if (confirmMessage) {
            e.preventDefault();
            setConfirming(true);
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
      {confirmMessage && (
        <ConfirmDialog
          open={confirming}
          message={confirmMessage}
          confirmLabel="Continue"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            btnRef.current?.form?.requestSubmit(btnRef.current);
          }}
        />
      )}
    </>
  );
}
