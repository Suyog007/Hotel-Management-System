"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BedDouble,
  ImageIcon,
  Menu,
  Star,
  UtensilsCrossed,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Defined here (vs in site-header.tsx) because Server Components can't pass
// function references — like Lucide icon components — across the boundary.
const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/#rooms", label: "Rooms", icon: BedDouble },
  { href: "/#menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/#gallery", label: "Gallery", icon: ImageIcon },
  { href: "/#reviews", label: "Reviews", icon: Star },
  { href: "/my-bookings", label: "My bookings", icon: User },
];

export function MobileNav({ hotelName }: { hotelName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Accessibility: while open, trap Tab within the drawer, close on Escape,
  // move focus into the panel, and restore focus to the trigger on close.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a, button")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          open ? "visible" : "invisible",
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          tabIndex={open ? 0 : -1}
          className={cn(
            "absolute inset-0 z-0 bg-black/60 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <aside
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${hotelName} menu`}
          className={cn(
            "absolute right-0 top-0 z-10 flex h-full w-[85vw] max-w-sm flex-col bg-white shadow-2xl transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "translate-x-full",
          )}
          style={{ backgroundColor: "#ffffff" }}
        >
          <div className="flex items-center justify-between border-b border-border/60 p-4">
            <div className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-accent" />
              <span className="font-display text-base font-semibold">{hotelName}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="space-y-2 p-3">
            {LINKS.map((l) => {
              const active =
                pathname === l.href ||
                (l.href !== "/" && pathname?.startsWith(l.href + "/"));
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  // Close on tap: 4 of 5 links are hash links (/#rooms …) that
                  // don't change usePathname(), so the pathname effect above
                  // never fires for them — without this the drawer would stay
                  // open (and body scroll locked) on the homepage.
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3.5 text-base font-medium shadow-sm transition-all active:scale-[0.98]",
                    active
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-gray-200 bg-white text-gray-900 hover:border-primary/30 hover:bg-gray-50",
                  )}
                  style={!active ? { backgroundColor: "#ffffff" } : undefined}
                >
                  {Icon && (
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0",
                        active ? "text-primary" : "text-gray-500",
                      )}
                    />
                  )}
                  <span>{l.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
      </div>
    </>
  );
}
