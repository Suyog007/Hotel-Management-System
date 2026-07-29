"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
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
 * `formNoValidate` is required: the surrounding form has `required` fields and
 * we must not block a delete on their validity.
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
  return (
    <Button
      type="submit"
      variant="ghost"
      size={size}
      formAction={action}
      formNoValidate
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
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
  );
}
