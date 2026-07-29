import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Footer strip for the buttons at the end of an edit form.
 *
 * Every back-office form ends with one of these so action buttons sit on a
 * single line at a single size (`sm` inside list rows, default for page-level
 * primary forms) instead of stacking at mismatched heights.
 */
export function FormActions({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-t border-border/60 pt-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
