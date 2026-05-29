"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dashboard / admin layout shell with a desktop sidebar and a mobile drawer.
 * Receives the sidebar as a server-rendered child so the sidebar itself can
 * still do DB lookups; only the open/close state lives client-side.
 */
export function ResponsiveShell({
  sidebar,
  brand,
  children,
}: {
  sidebar: React.ReactNode;
  brand: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on every route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-card px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="font-display text-base font-semibold">{brand}</p>
        <span className="w-9" aria-hidden />
      </div>

      <div className="flex min-h-[calc(100vh-3.5rem)] lg:min-h-screen">
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          tabIndex={open ? 0 : -1}
          className={cn(
            "fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />

        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out lg:static lg:translate-x-0 lg:transform-none",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className="relative h-full">
            {sidebar}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-md bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <main id="main" className="flex-1 overflow-x-hidden bg-background">
          <div className="p-5 md:p-8 lg:p-10">{children}</div>
        </main>
      </div>
    </>
  );
}
