"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

/**
 * Destructive submit that lives *inside* the same <form> as Save and routes to
 * a different server action via `formAction`.
 *
 * Two upsides over the old "second <form> stacked underneath" pattern:
 *  - Save and Delete render on one line at one size.
 *  - No duplicated hidden `id` input — the delete action reads `id` from the
 *    edit form's own fields.
 *
 * Clicking opens an in-app ConfirmDialog (not `window.confirm`); confirming
 * submits the form with this button as the submitter, so `formAction` +
 * `formNoValidate` still apply. `formNoValidate` is required: the surrounding
 * form has `required` fields and we must not block a delete on their validity.
 */
export function DeleteButton({
  action,
  confirmMessage = "Delete this permanently? This can't be undone.",
  children = "Delete",
  className,
  size = "sm",
  ...rest
}: Omit<ButtonProps, "type" | "formAction" | "variant"> & {
  action: (formData: FormData) => void | Promise<void>;
  confirmMessage?: string;
  children?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  const [confirming, setConfirming] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        ref={btnRef}
        type="submit"
        variant="ghost"
        size={size}
        formAction={action}
        formNoValidate
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          setConfirming(true);
        }}
        className={cn(
          "text-destructive hover:bg-destructive/10 hover:text-destructive",
          className,
        )}
        {...rest}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        {children}
      </Button>
      <ConfirmDialog
        open={confirming}
        message={confirmMessage}
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          // Submit with this button as the submitter — requestSubmit fires
          // the form's submit directly without re-running this onClick.
          btnRef.current?.form?.requestSubmit(btnRef.current);
        }}
      />
    </>
  );
}
