/**
 * Static stand-in for `SiteHeader` inside route `loading.tsx` files. The real
 * header reads the session (async), which would suspend and defeat the point
 * of an instant loading screen — this mirrors its exact chrome (onyx bar,
 * h-16, brand dot + name) so the page doesn't jump when the real one mounts.
 */
export function HeaderPlaceholder() {
  return (
    <div className="sticky top-0 z-30 border-b border-onyx/60 bg-onyx text-cream">
      <div className="container flex h-16 items-center gap-2.5">
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-gold" />
        <span className="font-display text-lg font-bold tracking-tight text-cream">
          Hotel Vardani
        </span>
      </div>
    </div>
  );
}
