import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Metric({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  tone?: "default" | "accent" | "primary";
  className?: string;
}) {
  const body = (
    <div
      className={cn(
        "group flex h-full flex-col justify-between gap-4 rounded-lg border border-border/70 bg-card p-5 shadow-soft transition-all",
        href && "cursor-pointer hover:-translate-y-0.5 hover:shadow-soft-lg",
        tone === "accent" && "bg-accent/10 border-accent/30",
        tone === "primary" && "bg-primary text-primary-foreground border-primary",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "text-xs font-medium uppercase tracking-wider",
            tone === "primary" ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        {Icon && (
          <Icon
            className={cn(
              "h-5 w-5",
              tone === "primary"
                ? "text-primary-foreground/80"
                : tone === "accent"
                  ? "text-accent"
                  : "text-muted-foreground/70",
            )}
          />
        )}
      </div>
      <div>
        <p
          className={cn(
            "font-display text-3xl font-semibold leading-none tracking-tight",
            tone === "primary" ? "text-primary-foreground" : "text-foreground",
          )}
        >
          {value}
        </p>
        {hint && (
          <p
            className={cn(
              "mt-2 text-xs",
              tone === "primary" ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            {hint}
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}
