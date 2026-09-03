"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * In-app replacement for `window.confirm` on destructive/irreversible actions.
 * Non-blocking, themed, and testable through the DOM — the native dialog is
 * none of those. Rendered inside the triggering <form>, so both buttons are
 * `type="button"` to avoid submitting it themselves.
 */
export function ConfirmDialog({
  open,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Land focus on the safe choice; Escape backs out.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-foreground/40 backdrop-blur-sm"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={message}
        className="relative w-full max-w-sm rounded-md border border-foreground/10 bg-card p-5 shadow-soft-lg"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            aria-hidden
            className={destructive ? "mt-0.5 h-5 w-5 shrink-0 text-destructive" : "mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"}
          />
          <p className="text-sm">{message}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
