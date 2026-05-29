import { Star } from "lucide-react";

export type GoogleSummary = {
  rating: number | null;
  ratingCount: number | null;
  uri: string | null;
};

/**
 * Small "★ 4.3 on Google · 55" chip that links to the Maps listing in a
 * new tab. Renders null when there's nothing to show (Place ID not set
 * or never refreshed). Use it anywhere you want quick social proof.
 */
export function GoogleRatingChip({
  summary,
  variant = "light",
}: {
  summary: GoogleSummary;
  variant?: "light" | "dark";
}) {
  if (summary.rating == null) return null;
  const rating = Number(summary.rating);

  const base =
    variant === "dark"
      ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
      : "border-border bg-card text-foreground hover:border-accent/40 hover:bg-accent/5";

  const content = (
    <>
      <Star
        className={
          variant === "dark"
            ? "h-3.5 w-3.5 fill-accent text-accent"
            : "h-3.5 w-3.5 fill-accent text-accent"
        }
      />
      <span className="font-semibold">{rating.toFixed(1)}</span>
      <span className={variant === "dark" ? "text-primary-foreground/70" : "text-muted-foreground"}>
        on Google
        {summary.ratingCount != null && summary.ratingCount > 0 && (
          <> · {summary.ratingCount.toLocaleString()}</>
        )}
      </span>
    </>
  );

  const className = `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${base}`;

  if (summary.uri) {
    return (
      <a
        href={summary.uri}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }
  return <span className={className}>{content}</span>;
}
