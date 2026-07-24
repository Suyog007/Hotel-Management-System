import { HeaderPlaceholder } from "@/components/public/header-placeholder";
import { Skeleton } from "@/components/ui/skeleton";

/** Instant skeleton for /rooms — mirrors the card grid so nothing jumps. */
export default function RoomsLoading() {
  return (
    <>
      <HeaderPlaceholder />
      <main id="main" aria-busy className="container py-12 md:py-16">
        <div className="mb-10 space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft"
            >
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-3 p-5">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <div className="flex gap-1.5 pt-1">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
