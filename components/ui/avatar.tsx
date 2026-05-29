import * as React from "react";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const dim = `${size}px`;
  if (src) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt={name}
        style={{ width: dim, height: dim }}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      style={{ width: dim, height: dim }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold uppercase text-accent",
        className,
      )}
      aria-label={name}
    >
      {initials(name) || "·"}
    </span>
  );
}
