import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Collapsed "＋ New …" disclosure that holds a create form.
 *
 * Back-office pages used to open with a fully-expanded create form, pushing the
 * records you actually came to manage below the fold. Here the create form is
 * one line until you ask for it. Plain <details> — no client JS, so it still
 * works inside server components.
 */
export function CreatePanel({
  title,
  description,
  defaultOpen = false,
  className,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-[4px] border border-dashed border-foreground/25 bg-card/50",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
        <Plus
          aria-hidden
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
        />
        <span>{title}</span>
        {description && (
          <span className="hidden truncate text-xs font-normal text-muted-foreground sm:inline">
            — {description}
          </span>
        )}
      </summary>
      <div className="border-t border-border/60 p-4">{children}</div>
    </details>
  );
}
