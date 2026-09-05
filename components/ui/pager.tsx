import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Prev / next paging strip for the server-rendered back-office lists.
 *
 * Was copy-pasted byte-for-byte into five pages (audit, gallery, testimonials,
 * cancellations, reviews), each rendering its links as bare `<a>` with a
 * hand-rolled `px-3 py-1.5` — a third button height sitting next to the `sm`
 * and default buttons everywhere else. One component now, on `buttonVariants`,
 * so paging looks like every other control in the back office.
 *
 * Links, not buttons: paging is a plain GET, so it stays crawlable and
 * middle-clickable. Every current search param except `page` is carried over.
 */
export function Pager({
  page,
  pages,
  sp,
  className,
}: {
  page: number;
  pages: number;
  sp: Record<string, string | undefined>;
  className?: string;
}) {
  if (pages <= 1) return null;

  const carried: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (v && k !== "page") carried[k] = v;
  }
  const href = (p: number) =>
    `?${new URLSearchParams({ ...carried, page: String(p) })}`;

  const link = cn(buttonVariants({ variant: "outline", size: "sm" }));

  return (
    <div className={cn("flex items-center justify-between text-sm", className)}>
      <span className="text-muted-foreground">
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <a href={href(page - 1)} className={link}>
            ← Prev
          </a>
        )}
        {page < pages && (
          <a href={href(page + 1)} className={link}>
            Next →
          </a>
        )}
      </div>
    </div>
  );
}
