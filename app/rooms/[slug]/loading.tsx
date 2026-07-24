import { HeaderPlaceholder } from "@/components/public/header-placeholder";
import { Skeleton } from "@/components/ui/skeleton";

/** Instant skeleton for a room detail page — gallery left, booking card right. */
export default function RoomDetailLoading() {
  return (
    <>
      <HeaderPlaceholder />
      <main id="main" aria-busy className="container py-12 md:py-16">
        <Skeleton className="mb-6 h-4 w-40" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="col-span-2 aspect-[16/9] w-full rounded-2xl" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-xl" />
              ))}
            </div>
            <div className="mt-8 space-y-3">
              <Skeleton className="h-9 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-soft">
            <Skeleton className="h-7 w-32" />
            <div className="mt-6 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
