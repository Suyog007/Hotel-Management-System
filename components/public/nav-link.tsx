"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
  variant = "sidebar",
  className,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "sidebar" | "public";
  className?: string;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || (href !== "/" && pathname?.startsWith(href + "/"));

  if (variant === "public") {
    // Header sits on a forest bar → white-wash text, rosewood active marker.
    return (
      <Link
        href={href}
        className={cn(
          "rounded-[2px] px-3 py-2 text-sm font-medium text-white-wash/70 transition-colors hover:text-white-wash",
          active && "text-white-wash",
          className,
        )}
      >
        {children}
        {active && (
          <span aria-hidden className="ml-2 inline-block h-1 w-1 rounded-full bg-rosewood-light align-middle" />
        )}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}
