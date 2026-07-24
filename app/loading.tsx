import { HeaderPlaceholder } from "@/components/public/header-placeholder";

/**
 * Root loading screen — shown instantly on navigation to any route without a
 * more specific `loading.tsx` (rooms and back-office have their own).
 */
export default function RootLoading() {
  return (
    <>
      <HeaderPlaceholder />
      <main
        id="main"
        aria-busy
        className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16"
      >
        <span
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"
        />
        <p className="eyebrow text-sm text-muted-foreground">Loading…</p>
      </main>
    </>
  );
}
