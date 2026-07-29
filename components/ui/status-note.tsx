import { AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * The `?saved=1` / `?error=…` banner every back-office page redirects back to.
 * One component so the wording, colour and spacing don't drift per page.
 */
export function StatusNote({
  saved,
  error,
  savedLabel = "Saved.",
}: {
  saved?: string;
  error?: string;
  savedLabel?: string;
}) {
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }
  if (saved) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
        <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-emerald-600" />
        <span>{savedLabel}</span>
      </div>
    );
  }
  return null;
}
