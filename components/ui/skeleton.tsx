import { cn } from "@/lib/utils";

/** Pulsing placeholder block for route-level loading states. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}
