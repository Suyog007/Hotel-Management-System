import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for /admin/* pages. Renders inside the shell layout, so the
 * sidebar stays put and only the content area pulses.
 */
export default function AdminLoading() {
  return (
    <div aria-busy className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
